/**
 * 引用の外へ出る操作
 *
 * Return は段落の中の改行や段落の分割にしかならず（lineBreakPlugin.ts）、
 * 文書の最後が引用だとその後ろにキャレットを置ける場所がないため、外へ出る手段がなかった。
 *
 * - 引用の中の空段落での Return / 引用の先頭での Backspace: その段落を引用の外へ出す
 * - 文書の最後の引用から ↓ / 引用より下の余白を押す: 引用の後ろに段落を足して移る
 */
import { TextSelection } from '@milkdown/prose/state';
import type { EditorState, Transaction } from '@milkdown/prose/state';
import type { ResolvedPos } from '@milkdown/prose/model';
import { liftTarget } from '@milkdown/prose/transform';
import type { EditorView } from '@milkdown/prose/view';

/** カーソルのある段落が引用の直下にあるか */
export function inQuoteParagraph($pos: ResolvedPos): boolean {
  return $pos.depth > 0 && $pos.node(-1).type.name === 'blockquote';
}

/** カーソルのある段落を引用の外へ出す。引用の途中なら引用は前後に分かれる */
export function liftFromQuote(state: EditorState, dispatch: (tr: Transaction) => void): boolean {
  const range = state.selection.$from.blockRange();
  const target = range && liftTarget(range);
  if (!range || target == null) return false;
  dispatch(state.tr.lift(range, target).scrollIntoView());
  return true;
}

/** 文書の最後が引用なら、その後ろに空の段落を足してキャレットを移す */
export function exitTrailingQuote(view: EditorView): boolean {
  const { doc, schema } = view.state;
  if (doc.lastChild?.type.name !== 'blockquote') return false;
  const tr = view.state.tr.insert(doc.content.size, schema.nodes.paragraph.create());
  tr.setSelection(TextSelection.create(tr.doc, doc.content.size + 1));
  view.dispatch(tr.scrollIntoView());
  return true;
}
