/**
 * 箇条書きの中の項目を番号付きリストに（またはその逆に）切り替えるプラグイン
 *
 * Milkdown 標準の `1. ` / `- ` の入力ルールと Cmd+Opt+7 / Cmd+Opt+8 は段落をリストで
 * 包む操作なので、すでにリストの項目の中では効かない（項目の先頭は段落でなければならず、
 * 段落をリストで包めない）。そのため、箇条書きの入れ子の中で番号付きリストを始められなかった。
 *
 * - 箇条書きの項目の先頭で `1. ` と打つ / Cmd+Opt+7 → その項目を番号付きリストにする
 * - 番号付きリストの項目の先頭で `- ` と打つ / Cmd+Opt+8 → その項目を箇条書きにする
 *
 * 切り替えるのはカーソルのある項目だけ。前後の項目は元の種類のリストのまま残し、
 * 隣に同じ種類のリストがあればつなげる。
 */
import { InputRule } from '@milkdown/prose/inputrules';
import { Plugin, PluginKey, TextSelection } from '@milkdown/prose/state';
import type { EditorState, Transaction } from '@milkdown/prose/state';
import { Fragment } from '@milkdown/prose/model';
import type { Node, NodeType } from '@milkdown/prose/model';
import { canJoin } from '@milkdown/prose/transform';
import { $inputRule, $prose } from '@milkdown/utils';

type ListKind = 'bullet' | 'ordered';

const LIST_NODE: Record<ListKind, string> = { bullet: 'bullet_list', ordered: 'ordered_list' };

/** pos を含む一番内側の list_item の深さ */
function listItemDepth(doc: Node, pos: number): number | null {
  const $pos = doc.resolve(pos);
  for (let d = $pos.depth; d > 0; d--) {
    if ($pos.node(d).type.name === 'list_item') return d;
  }
  return null;
}

/**
 * pos を含む項目を kind のリストに切り出す。すでにその種類なら何もせず false。
 * order は番号付きリストの開始番号。
 */
function switchItem(tr: Transaction, pos: number, kind: ListKind, order = 1): boolean {
  const itemDepth = listItemDepth(tr.doc, pos);
  if (itemDepth === null) return false;
  const $pos = tr.doc.resolve(pos);
  const listDepth = itemDepth - 1;
  const list = $pos.node(listDepth);
  const toType: NodeType = tr.doc.type.schema.nodes[LIST_NODE[kind]];
  if (list.type === toType) return false;

  const index = $pos.index(listDepth);
  const item = list.child(index);
  const switched = item.type.create(
    { ...item.attrs, listType: kind, label: kind === 'ordered' ? `${order}.` : '•' },
    item.content,
    item.marks,
  );
  const newList = toType.create(
    kind === 'ordered' ? { order, spread: list.attrs.spread } : { spread: list.attrs.spread },
    switched,
  );

  const items = (from: number, to: number) => {
    const nodes: Node[] = [];
    for (let i = from; i < to; i++) nodes.push(list.child(i));
    return nodes;
  };
  const before = index > 0 ? list.copy(Fragment.from(items(0, index))) : null;
  const after = index < list.childCount - 1 ? list.copy(Fragment.from(items(index + 1, list.childCount))) : null;

  const listStart = $pos.before(listDepth);
  const offsetInItem = pos - $pos.before(itemDepth);
  const parts = [before, newList, after].filter((n): n is Node => n !== null);
  tr.replaceWith(listStart, listStart + list.nodeSize, parts);

  const newListStart = listStart + (before?.nodeSize ?? 0);
  tr.setSelection(TextSelection.create(tr.doc, newListStart + 1 + offsetInItem));

  // 隣り合った同じ種類のリストをつなげる（後ろから先に処理して位置ずれを避ける）。
  // canJoin は中身が入るかしか見ず、箇条書きと番号付きリストもつなげてしまうので種類も比べる
  const newListEnd = newListStart + newList.nodeSize;
  if (sameTypeAround(tr.doc, newListEnd)) tr.join(newListEnd);
  if (sameTypeAround(tr.doc, newListStart)) tr.join(newListStart);
  return true;
}

function sameTypeAround(doc: Node, pos: number): boolean {
  const $pos = doc.resolve(pos);
  return !!$pos.nodeBefore && $pos.nodeBefore.type === $pos.nodeAfter?.type && canJoin(doc, pos);
}

/** カーソルが項目の先頭の段落の中にあるか（入力ルールは項目の書き出しでだけ効かせる） */
function atItemFirstParagraph(state: EditorState, pos: number): boolean {
  const $pos = state.doc.resolve(pos);
  if ($pos.parent.type.name !== 'paragraph' || $pos.depth < 2) return false;
  return $pos.node($pos.depth - 1).type.name === 'list_item' && $pos.index($pos.depth - 1) === 0;
}

function toHalfWidthDigits(s: string): string {
  return s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

/** 項目の先頭で `1. `（全角の `１．` も可）→ 番号付きリスト */
export const orderedItemInputRule = $inputRule(() =>
  new InputRule(/^\s*([0-9０-９]+)[.．]\s$/, (state, match, start, end) => {
    if (!atItemFirstParagraph(state, start)) return null;
    const tr = state.tr.delete(start, end);
    return switchItem(tr, start, 'ordered', Number(toHalfWidthDigits(match[1]))) ? tr : null;
  }),
);

/** 番号付きリストの項目の先頭で `- ` → 箇条書き */
export const bulletItemInputRule = $inputRule(() =>
  new InputRule(/^\s*([-+*])\s$/, (state, _match, start, end) => {
    if (!atItemFirstParagraph(state, start)) return null;
    const tr = state.tr.delete(start, end);
    return switchItem(tr, start, 'bullet') ? tr : null;
  }),
);

/**
 * Cmd+Opt+7 / Cmd+Opt+8 をリストの項目の中で押したとき。標準の keymap より先に
 * 処理するため handleDOMEvents で拾う。項目の外では標準の動作（段落をリストで包む）のまま。
 */
export const listTypeSwitchKeymap = $prose(() =>
  new Plugin({
    key: new PluginKey('list-type-switch'),
    props: {
      handleDOMEvents: {
        keydown(view, event) {
          if (!(event.metaKey || event.ctrlKey) || !event.altKey || event.shiftKey) return false;
          const kind: ListKind | null =
            event.code === 'Digit7' ? 'ordered' : event.code === 'Digit8' ? 'bullet' : null;
          if (!kind) return false;
          const { from } = view.state.selection;
          if (listItemDepth(view.state.doc, from) === null) return false;
          const tr = view.state.tr;
          if (!switchItem(tr, from, kind)) return false;
          event.preventDefault();
          view.dispatch(tr.scrollIntoView());
          return true;
        },
      },
    },
  }),
);

export const listTypeSwitch = [orderedItemInputRule, bulletItemInputRule, listTypeSwitchKeymap];
