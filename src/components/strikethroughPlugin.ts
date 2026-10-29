/**
 * 打ち消し線（Markdown の `~~text~~`）
 *
 * - Cmd+Shift+X: 選択範囲の打ち消し線を切り替える
 * - `~~text~~` と打つと打ち消し線になる
 *
 * GFM の記法のうち打ち消し線だけを読み書きする。remark-gfm を丸ごと入れると表や
 * 脚注も構文として読まれ、対応するノードが無いために文書を開けなくなるため。
 */
import { commandsCtx } from '@milkdown/core';
import { markRule } from '@milkdown/prose';
import { toggleMark } from '@milkdown/prose/commands';
import { $command, $inputRule, $markSchema, $remark, $useKeymap } from '@milkdown/utils';
import { gfmStrikethrough } from 'micromark-extension-gfm-strikethrough';
import { gfmStrikethroughFromMarkdown, gfmStrikethroughToMarkdown } from 'mdast-util-gfm-strikethrough';

interface ProcessorData {
  micromarkExtensions?: unknown[];
  fromMarkdownExtensions?: unknown[];
  toMarkdownExtensions?: unknown[];
}

const remarkStrikethrough = $remark('remarkStrikethrough', () =>
  function (this: { data: () => ProcessorData }) {
    const data = this.data();
    (data.micromarkExtensions ??= []).push(gfmStrikethrough({ singleTilde: false }));
    (data.fromMarkdownExtensions ??= []).push(gfmStrikethroughFromMarkdown());
    (data.toMarkdownExtensions ??= []).push(gfmStrikethroughToMarkdown());
  },
);

const strikethroughSchema = $markSchema('strike_through', () => ({
  parseDOM: [
    { tag: 'del' },
    { tag: 's' },
    { style: 'text-decoration', getAttrs: (value) => (value === 'line-through') as false },
  ],
  toDOM: () => ['del'],
  parseMarkdown: {
    match: (node) => node.type === 'delete',
    runner: (state, node, markType) => {
      state.openMark(markType);
      state.next(node.children);
      state.closeMark(markType);
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === 'strike_through',
    runner: (state, mark) => {
      state.withMark(mark, 'delete');
    },
  },
}));

const toggleStrikethroughCommand = $command('ToggleStrikethrough', (ctx) => () =>
  toggleMark(strikethroughSchema.type(ctx)),
);

const strikethroughInputRule = $inputRule((ctx) =>
  markRule(/~~([^~]+)~~$/, strikethroughSchema.type(ctx)),
);

const strikethroughKeymap = $useKeymap('strikethroughKeymap', {
  ToggleStrikethrough: {
    shortcuts: 'Mod-Shift-x',
    command: (ctx) => {
      const commands = ctx.get(commandsCtx);
      return () => commands.call(toggleStrikethroughCommand.key);
    },
  },
});

export const strikethrough = [
  remarkStrikethrough,
  strikethroughSchema,
  toggleStrikethroughCommand,
  strikethroughInputRule,
  strikethroughKeymap,
].flat();
