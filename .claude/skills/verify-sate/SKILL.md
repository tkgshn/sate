---
name: verify-sate
description: Sate（Tauri v2 + Milkdown の macOS 向け執筆エディタ）を本体と別の identifier・別の文書フォルダで起動し、本文の入力・組版・保存を実アプリで確かめる。Sate のエディタや組版を変えたあと、または不具合の再現を確かめるときに使う。
---

# verify-sate

本人は普段 `/Applications/Sate.app`（`club.image.sate`、文書は `~/Documents/Sate`）で書いている。
**検証は必ず `club.image.sate.dev` の SateDev で行い、`club.image.sate` を操作の対象にしない。** 終了もさせない。
2 つは別の identifier・別の設定・別の文書フォルダなので同時に動かせる。

以下の `sate-dev.sh` は `.claude/skills/verify-sate/scripts/sate-dev.sh`（repo root から実行）。

## Launch

```sh
.claude/skills/verify-sate/scripts/sate-dev.sh build   # 初回とコード変更後。1〜2 分
.claude/skills/verify-sate/scripts/sate-dev.sh seed    # テスト用フォルダと DB を作り直し、seed/*.md を入れる
.claude/skills/verify-sate/scripts/sate-dev.sh launch  # open -g で起動し pid を記録する
```

起動すると常に新規ファイルが開き、本文にフォーカスが入る。右上にファイル名（`YYYY-MM-DD-NNN`）、
下に文字数が出ていれば使える状態。`src-tauri/src/lib.rs` が全画面にするので、窓は別のスペースに置かれる。

## Doctor

```sh
.claude/skills/verify-sate/scripts/sate-dev.sh doctor
```

読み取りのみ。bundle id が `.dev`、ビルド時刻が repo HEAD より新しい、`vault: ok (isolated)` を確かめる。
ビルドが HEAD より古ければ `build` し直す。

## Drive

computer-use の **背景操作** `app_*` を bundle id `club.image.sate.dev` に対して使う。
`request_access` には表示名 `SateDev` を渡す（起動後でないと解決されない）。本文には AX 要素が無い（AX summary は空）ので、確認は画像と保存された md で行う。

```jsonc
// app_batch の例
[{"action":"type","text":"> 引用の行"},{"action":"key","combo":"return"},{"action":"screenshot"}]
```

| 操作 | 背景操作での可否 |
|---|---|
| 文字入力（`type`）、`return`、矢印、`> ` などの入力ルール | 届く |
| クリック（`click`） | **届かない。** 結果は `ok` と返るが、キャレットは動かない |
| Cmd 付きのキー（Cmd+O、Cmd+Shift+D など） | **届かない。** Web 側の keydown で処理していてメニューも無く、`CGEvent.postToPid` も効かない |

クリックと Cmd キーは、確かめたように見えて実は効いていないことがある。
**別の行をクリックして目印を打ち、どこに入ったかを見れば切り分けられる。**
全画面操作（`computer_batch`）は本人の画面を奪ううえ、窓が別スペースなので届かない。使わない。

クリックや Cmd キーの経路は、次のどちらかで確かめる。

1. harness（git 管理外の `harness.html`）を vite で配信し、Playwright WebKit で動かす。
   playwright-core は `~/Developer/plural-reality/cartographer/node_modules/playwright-core`（webkit-2248 と一致）を流用できる。
2. 本人に Sate を再起動して試してもらう。

## Evidence

- 本文の状態の正本は、テスト用フォルダの md（自動保存はタイピングが止まって 1.5 秒後）。画面だけで判定しない。
- 画像は `app_screenshot` の結果を残す。保存先は `sate-dev.sh evidence-dir` の出力（`~/Library/Application Support/club.image.sate.dev/verify-evidence/`）で、日付のフォルダを切る。
- 操作の前後を残す。修正の確認なら、修正前と同じ手順で症状が消えたことを示す。
- `?md=` などの URL に本人のメモ本文を載せない。harness には seed か合成した文書を渡す。

## Cleanup

```sh
.claude/skills/verify-sate/scripts/sate-dev.sh stop
```

記録した pid だけを止める。プロセス名では止めない（本体も実行ファイル名が `sate` なので巻き込む）。
`verify-evidence/` は消さない。`seed` は `verify-vault` と DB だけを作り直す。

## Helpers

- `scripts/sate-dev.sh build|seed|launch|doctor|stop|evidence-dir`
- `seed/*.md`: 確かめる機能ごとの文書（URL、引用、箇条書きと画像）
- `features/README.md`: 機能マップ。保守は `/maintain-verification-skill`
