/**
 * URL などの長い英数字の並びに折り返しを許す装飾を付けるプラグイン（理由は breakableTokens.ts）
 *
 * 文書には手を加えず、表示だけを変える。
 * 変換中に範囲を作り直すと確定前の文字列の DOM を壊すので、変換中は位置の追従だけにする。
 */
import { Plugin, PluginKey } from '@milkdown/prose/state';
import type { Node } from '@milkdown/prose/model';
import { Decoration, DecorationSet } from '@milkdown/prose/view';
import { $prose } from '@milkdown/utils';
import { BREAKABLE_CLASS, breakableRanges } from '../lib/breakableTokens';

function buildDecorations(doc: Node): DecorationSet {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    for (const [start, end] of breakableRanges(node.text)) {
      decorations.push(Decoration.inline(pos + start, pos + end, { class: BREAKABLE_CLASS }));
    }
  });
  return DecorationSet.create(doc, decorations);
}

const breakableTokenKey = new PluginKey<DecorationSet>('breakable-token');

export const breakableTokenPlugin = $prose(() => {
  return new Plugin<DecorationSet>({
    key: breakableTokenKey,
    state: {
      init: (_config, state) => buildDecorations(state.doc),
      apply(tr, decorations) {
        if (!tr.docChanged) return decorations;
        return tr.getMeta('composition') === undefined ? buildDecorations(tr.doc) : decorations.map(tr.mapping, tr.doc);
      },
    },
    props: {
      decorations: (state) => breakableTokenKey.getState(state),
    },
  });
});
