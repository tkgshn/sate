/**
 * 本文の外（左右の余白・上下の余白）を押したときのキャレット配置とドラッグ選択
 *
 * 余白は ProseMirror の外なので、ブラウザ任せではキャレットが置かれない。
 * 押した高さの行にキャレットを置き、そのままドラッグすれば選択を広げる。
 * 本文より上なら先頭、下なら末尾として扱う。
 *
 * 以前は click で「本文より上なら先頭、それ以外は末尾」にしていたため、
 * 行の少し左右を押す・余白からドラッグして選択すると、キャレットが文書の末尾に飛んでいた。
 */
import { Selection, TextSelection } from '@milkdown/prose/state';
import type { EditorView } from '@milkdown/prose/view';

/** 余白として扱う要素（ここを押したときだけ処理する） */
const MARGIN_SELECTOR = '.app, .editor-container, .editor-wrapper, .side-memo-gutter';

export function isMarginTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.matches(MARGIN_SELECTOR);
}

/** 画面座標に一番近い文書内の位置。横は本文の幅に収め、上下にはみ出たら先頭・末尾 */
function posNearCoords(view: EditorView, x: number, y: number): number {
  const { doc } = view.state;
  const rect = (view.dom as HTMLElement).getBoundingClientRect();
  if (y < rect.top) return Selection.atStart(doc).from;
  if (y > rect.bottom) return Selection.atEnd(doc).from;
  const left = Math.min(Math.max(x, rect.left + 1), rect.right - 1);
  return view.posAtCoords({ left, top: y })?.pos ?? Selection.atEnd(doc).from;
}

/**
 * 余白での mousedown からキャレット配置とドラッグ選択を始める。
 * Shift を押していれば、いまの選択の起点から広げる。
 */
export function startMarginPress(view: EditorView, event: MouseEvent): void {
  event.preventDefault();
  const head = posNearCoords(view, event.clientX, event.clientY);
  const anchor = event.shiftKey ? view.state.selection.anchor : head;
  const select = (h: number) =>
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, anchor, h)));

  select(head);
  view.focus();

  const onMove = (e: MouseEvent) => {
    if (!view.isDestroyed) select(posNearCoords(view, e.clientX, e.clientY));
  };
  const onUp = () => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}
