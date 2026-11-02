/**
 * 選択・カーソルの不具合を調べるための操作記録
 *
 * 「選択が下に移る」「カーソルが思った所に行かない」は、再現手順が分からないまま
 * 普段使いの中で起きる。そこで直近の操作（キー、日本語入力の変換、マウス、
 * フォーカス、スクロール、ProseMirror のトランザクション）と、そのときの
 * ProseMirror の選択位置・画面上の選択位置を常にメモリ上に溜めておき、
 * おかしいと感じた直後に Cmd+Shift+D で JSON に書き出せるようにする。
 *
 * 本文の文字は記録しない（打った文字は 'char'、変換中の文字列は長さだけ）。
 * 書き出し先は設定ファイルと同じフォルダの traces/。
 */
import { Plugin, PluginKey } from '@milkdown/prose/state';
import type { Transaction } from '@milkdown/prose/state';
import type { EditorView } from '@milkdown/prose/view';
import { $prose } from '@milkdown/utils';
import { mkdir, writeTextFile, BaseDirectory } from '@tauri-apps/plugin-fs';
import { appConfigDir, join } from '@tauri-apps/api/path';
import { message } from '@tauri-apps/plugin-dialog';

/** 溜めておく件数。普段の入力で数十秒ぶん */
const MAX_ENTRIES = 1500;
/** 連続したスクロールを1件にまとめる間隔 */
const SCROLL_MERGE_MS = 50;

type Entry = { t: number; type: string } & Record<string, unknown>;

const entries: Entry[] = [];
let currentView: EditorView | null = null;

function push(type: string, data: Record<string, unknown> = {}): void {
  entries.push({ t: Math.round(performance.now()), type, ...data });
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
}

function describeTarget(target: EventTarget | null): string {
  if (!(target instanceof Element)) return target instanceof Node ? target.nodeName : String(target);
  const cls = typeof target.className === 'string' ? target.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
  return cls ? `${target.tagName.toLowerCase()}.${cls}` : target.tagName.toLowerCase();
}

/** ProseMirror の選択と、画面上（DOM）の選択を ProseMirror の位置に直したもの */
function selectionSnapshot(view: EditorView): Record<string, unknown> {
  const { anchor, head } = view.state.selection;
  const snap: Record<string, unknown> = {
    state: [anchor, head],
    composing: view.composing,
    focused: view.hasFocus(),
  };
  const dom = document.getSelection();
  if (dom && dom.anchorNode && dom.focusNode && view.dom.contains(dom.anchorNode) && view.dom.contains(dom.focusNode)) {
    try {
      const a = view.posAtDOM(dom.anchorNode, dom.anchorOffset);
      const h = view.posAtDOM(dom.focusNode, dom.focusOffset);
      snap.dom = [a, h];
      if (a !== anchor || h !== head) snap.mismatch = true;
    } catch {
      snap.dom = 'unresolved';
    }
  } else {
    snap.dom = dom?.anchorNode ? `outside:${describeTarget(dom.anchorNode.parentElement)}` : 'none';
  }
  return snap;
}

function nodePath(view: EditorView): string {
  const $head = view.state.selection.$head;
  const names: string[] = [];
  for (let d = 1; d <= $head.depth; d++) names.push($head.node(d).type.name);
  return names.join('>');
}

function withSelection(data: Record<string, unknown>): Record<string, unknown> {
  const view = currentView;
  return view && !view.isDestroyed ? { ...data, sel: selectionSnapshot(view) } : data;
}

function onKeyDown(e: KeyboardEvent): void {
  push('keydown', withSelection({
    key: e.key.length === 1 ? 'char' : e.key,
    code: e.code,
    mods: [e.metaKey && 'cmd', e.ctrlKey && 'ctrl', e.altKey && 'opt', e.shiftKey && 'shift'].filter(Boolean).join('+'),
    isComposing: e.isComposing,
    keyCode: e.keyCode,
    target: describeTarget(e.target),
  }));
}

function onComposition(e: CompositionEvent): void {
  push(e.type, withSelection({ len: e.data?.length ?? 0, target: describeTarget(e.target) }));
}

function onBeforeInput(e: InputEvent): void {
  push('beforeinput', withSelection({ inputType: e.inputType, isComposing: e.isComposing, target: describeTarget(e.target) }));
}

function onSelectionChange(): void {
  push('selectionchange', withSelection({}));
}

function onMouse(e: MouseEvent): void {
  const view = currentView;
  const at = view && !view.isDestroyed ? view.posAtCoords({ left: e.clientX, top: e.clientY }) : null;
  push(e.type, withSelection({
    x: Math.round(e.clientX),
    y: Math.round(e.clientY),
    detail: e.detail,
    shift: e.shiftKey,
    target: describeTarget(e.target),
    posAtCoords: at ? at.pos : null,
  }));
}

function onFocus(e: FocusEvent): void {
  push(e.type, withSelection({ target: describeTarget(e.target), related: describeTarget(e.relatedTarget) }));
}

function onScroll(e: Event): void {
  const el = e.target instanceof Element ? e.target : document.scrollingElement;
  const scrollTop = el ? Math.round(el.scrollTop) : null;
  const last = entries[entries.length - 1];
  const now = Math.round(performance.now());
  if (last && last.type === 'scroll' && now - last.t < SCROLL_MERGE_MS) {
    last.t = now;
    last.scrollTop = scrollTop;
    return;
  }
  push('scroll', { target: describeTarget(el), scrollTop });
}

function onTransaction(tr: Transaction): void {
  const meta: Record<string, unknown> = {};
  for (const key of ['uiEvent', 'pointer', 'composition', 'addToHistory', 'paste']) {
    const v = tr.getMeta(key);
    if (v !== undefined) meta[key] = v;
  }
  push('transaction', {
    docChanged: tr.docChanged,
    steps: tr.steps.length,
    selectionSet: tr.selectionSet,
    scrollIntoView: tr.scrolledIntoView,
    to: [tr.selection.anchor, tr.selection.head],
    ...meta,
  });
}

const LISTENERS: [string, EventListener][] = [
  ['keydown', onKeyDown as EventListener],
  ['compositionstart', onComposition as EventListener],
  ['compositionupdate', onComposition as EventListener],
  ['compositionend', onComposition as EventListener],
  ['beforeinput', onBeforeInput as EventListener],
  ['selectionchange', onSelectionChange],
  ['mousedown', onMouse as EventListener],
  ['mouseup', onMouse as EventListener],
  ['focusin', onFocus as EventListener],
  ['focusout', onFocus as EventListener],
  ['scroll', onScroll],
];

export const selectionTracePlugin = $prose(() =>
  new Plugin({
    key: new PluginKey('selection-trace'),
    state: {
      init: () => null,
      apply(tr) {
        onTransaction(tr);
        return null;
      },
    },
    view(view) {
      currentView = view;
      for (const [type, fn] of LISTENERS) document.addEventListener(type, fn, true);
      push('init', { docSize: view.state.doc.content.size });
      return {
        destroy() {
          for (const [type, fn] of LISTENERS) document.removeEventListener(type, fn, true);
          if (currentView === view) currentView = null;
        },
      };
    },
  }),
);

function timestamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/** 溜めた記録を書き出し、保存先を知らせる */
export async function dumpTrace(view: EditorView | null): Promise<void> {
  const now = Math.round(performance.now());
  const live = view && !view.isDestroyed;
  const report = {
    savedAt: new Date().toISOString(),
    now,
    userAgent: navigator.userAgent,
    doc: live ? { size: view.state.doc.content.size, path: nodePath(view) } : null,
    selection: live ? selectionSnapshot(view) : null,
    entries,
  };
  const name = `traces/trace-${timestamp()}.json`;
  try {
    await mkdir('traces', { baseDir: BaseDirectory.AppConfig, recursive: true });
    await writeTextFile(name, JSON.stringify(report, null, 1), { baseDir: BaseDirectory.AppConfig });
    const path = await join(await appConfigDir(), name);
    await message(`直前の操作の記録を保存しました。\n${path}`, { title: 'Sate', kind: 'info' });
  } catch (err) {
    console.error('Failed to save trace:', err);
    await message(`記録を保存できませんでした: ${String(err)}`, { title: 'Sate', kind: 'error' });
  }
}
