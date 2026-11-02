/**
 * 日本語入力（IME）の変換中・確定に使われたキーかどうかの判定
 *
 * macOS の WebKit は、変換を確定する Enter の keydown を compositionend の後に送ることがあり、
 * そのとき isComposing は false になる（keyCode は 229）。古い OS の WKWebView では
 * 順序がさらに前後するため、compositionend の直後の短い間に届いたキーも確定の一部とみなす。
 * 確定 Enter でタイトルから本文へ飛んだり、変換を取り消す Escape でメモや検索欄が
 * 閉じたりしないよう、Enter / Escape を拾うハンドラはすべてこれで先に弾く。
 */
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

/** compositionend の後、確定のキーとみなす期間 */
const AFTER_COMPOSITION_MS = 50;

let composing = false;
let compositionEndedAt = 0;

if (typeof document !== 'undefined') {
  document.addEventListener('compositionstart', () => { composing = true; }, true);
  document.addEventListener('compositionend', () => {
    composing = false;
    compositionEndedAt = Date.now();
  }, true);
}

export function isImeKeyEvent(event: KeyboardEvent | ReactKeyboardEvent): boolean {
  const e = 'nativeEvent' in event ? event.nativeEvent : event;
  return e.isComposing
    || e.keyCode === 229
    || composing
    || Date.now() - compositionEndedAt < AFTER_COMPOSITION_MS;
}
