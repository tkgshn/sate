# 箇条書きと画像の読み込み

既存のファイルを開いたときに要素が落ちないこと（`src/components/parsedAttrsSchema.ts`）。

## Sub-features
- 箇条書き、入れ子、番号付きリスト
- 画像（タイトルなし、代替テキストなしも）
- 開いて編集したあと、ファイルからそれらが消えないこと

## How to get to it (user POV)
Cmd+O で一覧を開き、`verify-list` を選ぶ。

## Driving it with app_*
背景操作では Cmd+O が届かないので、実アプリでは動かせない。
代わりに harness を Playwright WebKit で開き、コンソールの `RangeError` が 0 件で、doc に `bullet_list` / `ordered_list` / `image` があることを確かめる。
書き出しの比較は vite の `resolve.alias` で `prosemirror-model` を旧版へ向けたビルドと突き合わせる。

## Gotchas
- 起動時は常に新規ファイルなので、seed を置いても自動では開かない。
- prosemirror や Milkdown を上げたら必ず確かめる。編集だけのテストでは見つからない。
- 実アプリでの確認は未実施。本人に再起動後に開いてもらう必要がある。
