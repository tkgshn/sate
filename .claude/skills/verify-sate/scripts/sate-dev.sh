#!/bin/bash
# 検証用の SateDev を本体と別の identifier・別の文書フォルダで動かす。
# usage: sate-dev.sh build | seed | launch | doctor | stop | evidence-dir
set -u
REPO="$(cd "$(dirname "$0")/../../../.." && pwd)"
APP="$REPO/src-tauri/target/debug/bundle/macos/SateDev.app"
ID=club.image.sate.dev
SUPPORT="$HOME/Library/Application Support/$ID"
VAULT="$SUPPORT/verify-vault"
EVIDENCE="$SUPPORT/verify-evidence"
PIDFILE="$SUPPORT/verify.pid"
# ~/.local/bin/cc と古い Homebrew Rust を避ける
export PATH="$HOME/.cargo/bin:$PATH" CC=/usr/bin/clang CXX=/usr/bin/clang++ CARGO_TARGET_AARCH64_APPLE_DARWIN_LINKER=/usr/bin/cc
CONFIG='{"identifier":"club.image.sate.dev","productName":"SateDev","app":{"windows":[{"title":"SateDev","width":1200,"height":800,"fullscreen":false,"decorations":false,"resizable":true}]}}'

pid() { [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null && cat "$PIDFILE"; }

case "${1:-}" in
  build)
    cd "$REPO" && node_modules/.bin/tauri build --debug --bundles app -c "$CONFIG"
    ;;
  seed)
    [ -n "$(pid)" ] && { echo "SateDev is running; stop it first" >&2; exit 1; }
    mkdir -p "$SUPPORT"
    rm -rf "$VAULT"; mkdir -p "$VAULT" "$EVIDENCE"
    rm -f "$SUPPORT"/sate.db*
    printf '{"baseDir": "%s"}\n' "$VAULT" > "$SUPPORT/settings.json"
    cp "$REPO"/.claude/skills/verify-sate/seed/*.md "$VAULT"/
    ls "$VAULT"
    ;;
  launch)
    [ -n "$(pid)" ] && { echo "already running: $(pid)"; exit 0; }
    open -g "$APP"
    for _ in $(seq 1 40); do
      p=$(pgrep -f "$APP/Contents/MacOS/" | head -1)
      [ -n "$p" ] && { echo "$p" > "$PIDFILE"; echo "pid $p"; exit 0; }
      /bin/sleep 0.25
    done
    echo "SateDev did not start" >&2; exit 1
    ;;
  doctor)
    echo "bundle id:  $(defaults read "$APP/Contents/Info" CFBundleIdentifier 2>/dev/null)"
    echo "built:      $(stat -f %Sm "$APP/Contents/MacOS/"* 2>/dev/null)"
    echo "repo HEAD:  $(git -C "$REPO" log -1 --format='%h %cd' --date=format:'%b %e %H:%M:%S %Y')"
    echo "pid:        $(pid || echo none)"
    echo "baseDir:    $(cat "$SUPPORT/settings.json" 2>/dev/null)"
    case "$(cat "$SUPPORT/settings.json" 2>/dev/null)" in
      *"$VAULT"*) echo "vault:      ok (isolated)" ;;
      *) echo "vault:      NOT isolated; run seed"; exit 1 ;;
    esac
    ;;
  stop)
    p=$(pid) && kill "$p"; rm -f "$PIDFILE"; echo "stopped ${p:-nothing}"
    ;;
  evidence-dir)
    echo "$EVIDENCE"
    ;;
  *) sed -n 2,3p "$0"; exit 2 ;;
esac
