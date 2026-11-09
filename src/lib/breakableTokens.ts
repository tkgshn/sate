/**
 * どこで折り返してもよい文字列（URL と、空白のない長い英数字の並び）の検出
 *
 * 長い URL は折り返せる場所が少なく、ハイフンなどの手前で丸ごと次の行へ送られる。
 * 残された短い行を均等割付が字間で埋めるので、文字が大きく離れて見える。
 * 本文全体を break-all にすると英単語まで途中で切れるため、該当する範囲だけに適用する。
 */
const BREAKABLE_TOKEN = /[a-z][a-z0-9+.-]*:\/\/[!-~]+|[!-~]{24,}/gi;

export const BREAKABLE_CLASS = 'sate-breakable';

/** 文字列内で折り返しを許す範囲を [start, end) の並びで返す */
export function breakableRanges(text: string): [number, number][] {
  return Array.from(text.matchAll(BREAKABLE_TOKEN), (m): [number, number] => [m.index, m.index + m[0].length]);
}
