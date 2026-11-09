# 引用から出る操作

`src/components/quoteExit.ts`。

## Sub-features
- 引用の中の空段落で Return（途中なら引用が前後に分かれる）
- 引用の先頭で Backspace（前の段落につなげず引用を解く）
- 文書の最後の引用の最後の行で ↓
- 文書の最後の引用より下の余白を押す

## How to get to it (user POV)
本文で `> ` と打って引用を作る。Return 3 回（改行 → 段落分割 → 外へ）で外に出る。

## Driving it with app_*
`type` で `> 引用の行`、`key` で `return` を 3 回、`type` で `引用の外`。別の引用を作って `key` で `down`、`type` で `下キーで外`。
合格: 保存された md で `引用の外` と `下キーで外` の行頭に `> ` が無い。

## Gotchas
- 余白のクリックは背景操作では届かない。`ok` が返っても効いていない。harness を Playwright WebKit で動かして確かめる。
- 文書の最後の引用から出ると空段落が 1 つ増える（Backspace で戻せる）。
- Backspace は引用の先頭へキャレットを動かす必要がある。矢印だけで辿る。
