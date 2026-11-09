# 長い URL の折り返し

URL と、空白のない 24 文字以上の英数字の並びだけ、どこでも折り返せる（`src/lib/breakableTokens.ts`）。Rewind のプレビューも同じ。

## Sub-features
- 本文の URL が行末まで詰まり、前の和文の字間が開かない
- 英文は単語の途中で折り返さない

## How to get to it (user POV)
本文に和文と長い URL を続けて入力するか、貼り付ける。

## Driving it with app_*
`seed/verify-url.md` の本文 1 段落目を `type` で入力し、`screenshot` する。
合格: 1 行目が `tkgshn-` で切れず、「以前、scb に」の字間が開いていない。保存された md の URL は分割されず 1 続きのまま。

## Gotchas
- 均等割付の字間は文字の幅に含まれるので、隣り合う文字の隙間を測っても常に 0 になる。画像か 1 行の文字数で判定する（修正前は 1 行目が 35 文字、修正後は 48 文字）。
- 変換中は範囲を作り直さない設計。URL の直後での変換も確かめる。
