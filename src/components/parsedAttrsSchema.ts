/**
 * ファイルから読み込むとリストや画像が丸ごと消えるのを防ぐスキーマの上書き
 *
 * Milkdown 7.20 は Markdown の解析結果を、スキーマの validate と合わない型のまま渡す
 * （リストの spread は文字列、タイトルのない画像の title は null）。prosemirror-model
 * 1.25.12 から createAndFill でも属性を検証するようになり、RangeError でノードの生成に
 * 失敗する。Milkdown はこの例外をログに出すだけなので、その要素のない文書として開いて
 * しまい、そのまま編集すると自動保存でファイルからも消える。
 *
 * 該当する属性の検証だけを外す。値は Milkdown がそのまま書き出すので Markdown の形は変わらない。
 */
import { bulletListSchema, imageSchema, listItemSchema, orderedListSchema } from '@milkdown/preset-commonmark';
import type { $NodeSchema } from '@milkdown/utils';

function withoutValidate<Id extends string>(schema: $NodeSchema<Id>, names: string[]) {
  return schema.extendSchema((prev) => (ctx) => {
    const spec = prev(ctx);
    const attrs = { ...spec.attrs };
    for (const name of names) attrs[name] = { default: attrs[name]?.default };
    return { ...spec, attrs };
  });
}

export const parsedAttrsSchema = [
  withoutValidate(listItemSchema, ['spread']),
  withoutValidate(bulletListSchema, ['spread']),
  withoutValidate(orderedListSchema, ['spread']),
  withoutValidate(imageSchema, ['alt', 'title']),
].flat();
