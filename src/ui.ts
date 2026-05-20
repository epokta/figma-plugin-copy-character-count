// UI-side logic for the Copy character count panel.
// Runs inside the plugin's iframe; talks to main.ts via parent.postMessage /
// window.onmessage. Clipboard access lives here (the sandbox can't reach it).
//
// No in-plugin frame picker — the panel auto-fills from whatever the user has
// selected in the canvas, and updates as their selection changes.

import { buildPreview, displayText, PreviewRow } from './count/format';
import {
  CountFormat,
  MainToUiMessage,
  RoundingMode,
  TextBoxCount,
  UiToMainMessage,
} from './types';

// ---------------------------------------------------------------------------
// Postmessage helpers

function send(msg: UiToMainMessage) {
  parent.postMessage({ pluginMessage: msg }, '*');
}

// ---------------------------------------------------------------------------
// State

interface CopyState {
  currentFrameId: string | null;
  currentFrameName: string;
  items: TextBoxCount[];
  rowState: Map<string, { selected: boolean; rounding: RoundingMode }>;
  format: CountFormat;
}

const copy: CopyState = {
  currentFrameId: null,
  currentFrameName: '',
  items: [],
  rowState: new Map(),
  format: 'plain',
};

// ---------------------------------------------------------------------------
// Boot

document.addEventListener('DOMContentLoaded', () => {
  wireControls();
  wireResizeGrip();
});

// ---------------------------------------------------------------------------
// Incoming messages

window.onmessage = (event: MessageEvent) => {
  const msg = event.data && (event.data.pluginMessage as MainToUiMessage);
  if (!msg) return;
  switch (msg.type) {
    case 'no-selection':
      onNoSelection();
      return;
    case 'count-result':
      onCountResult(msg.frameId, msg.frameName, msg.items);
      return;
    case 'frame-preview':
      onFramePreview(msg.frameId, msg.bytes);
      return;
  }
};

// ---------------------------------------------------------------------------
// Wire bulk + format + copy controls

function wireControls() {
  (byId('bulk-rounding') as HTMLSelectElement).addEventListener('change', (e) => {
    const mode = (e.target as HTMLSelectElement).value as RoundingMode;
    for (const item of copy.items) {
      const st = copy.rowState.get(item.nodeId);
      if (st) st.rounding = mode;
    }
    renderCountTable();
    renderPreview();
  });

  (byId('bulk-select-all') as HTMLInputElement).addEventListener('change', (e) => {
    const checked = (e.target as HTMLInputElement).checked;
    for (const item of copy.items) {
      const st = copy.rowState.get(item.nodeId);
      if (st) st.selected = checked;
    }
    renderCountTable();
    renderPreview();
  });

  (byId('format-select') as HTMLSelectElement).addEventListener('change', (e) => {
    copy.format = (e.target as HTMLSelectElement).value as CountFormat;
    renderPreview();
  });

  byId('copy-now-btn').addEventListener('click', onCopyNow);
}

// ---------------------------------------------------------------------------
// Selection / count handling

function onNoSelection() {
  copy.currentFrameId = null;
  copy.currentFrameName = '';
  copy.items = [];
  copy.rowState.clear();
  show('no-selection-state');
  hide('frame-chosen');
  // Clear any leftover preview image so it doesn't linger.
  const img = byId('frame-preview-img') as HTMLImageElement;
  if (img.src && img.src.startsWith('blob:')) URL.revokeObjectURL(img.src);
  img.removeAttribute('src');
  img.classList.add('hidden');
}

function onCountResult(frameId: string, frameName: string, items: TextBoxCount[]) {
  const sameFrame = copy.currentFrameId === frameId;
  copy.currentFrameId = frameId;
  copy.currentFrameName = frameName;
  copy.items = items;

  if (sameFrame) {
    // Preserve user's row choices for nodes that still exist; add new ones; drop deleted ones.
    const existingIds = new Set(items.map((i) => i.nodeId));
    for (const id of Array.from(copy.rowState.keys())) {
      if (!existingIds.has(id)) copy.rowState.delete(id);
    }
    for (const item of items) {
      if (!copy.rowState.has(item.nodeId)) {
        copy.rowState.set(item.nodeId, { selected: true, rounding: 'none' });
      }
    }
  } else {
    // New frame — reset state.
    copy.rowState.clear();
    for (const item of items) {
      copy.rowState.set(item.nodeId, { selected: true, rounding: 'none' });
    }
    (byId('bulk-select-all') as HTMLInputElement).checked = true;
    (byId('bulk-rounding') as HTMLSelectElement).value = 'none';
    // Hide the old preview while the new one loads.
    const img = byId('frame-preview-img') as HTMLImageElement;
    if (img.src && img.src.startsWith('blob:')) URL.revokeObjectURL(img.src);
    img.removeAttribute('src');
    img.classList.add('hidden');
  }

  setText('chosen-frame-name', frameName || 'Frame');
  setText(
    'chosen-frame-sub',
    `${items.length} text layer${items.length === 1 ? '' : 's'}`
  );

  hide('no-selection-state');
  show('frame-chosen');
  renderCountTable();
  renderPreview();
  syncBulkSelectAll();
}

function onFramePreview(frameId: string, bytes: Uint8Array) {
  if (copy.currentFrameId !== frameId) return; // stale
  const blob = new Blob([bytes], { type: 'image/png' });
  const url = URL.createObjectURL(blob);
  const img = byId('frame-preview-img') as HTMLImageElement;
  if (img.src && img.src.startsWith('blob:')) URL.revokeObjectURL(img.src);
  img.src = url;
  img.classList.remove('hidden');
}

// ---------------------------------------------------------------------------
// Table + preview rendering

function renderCountTable() {
  const tbody = byId('count-tbody');
  tbody.innerHTML = '';
  if (copy.items.length === 0) {
    hide('count-table');
    show('no-text-state');
    return;
  }
  show('count-table');
  hide('no-text-state');

  for (const item of copy.items) {
    const st = copy.rowState.get(item.nodeId);
    if (!st) continue;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-check"><input type="checkbox" data-id="${escapeAttr(item.nodeId)}" ${st.selected ? 'checked' : ''} /></td>
      <td class="cell-label" title="${escapeAttr(item.label)}&#10;${escapeAttr(item.text)}">${escapeHtml(displayText(item.text))}</td>
      <td class="col-raw">${item.charCount}</td>
      <td class="col-rounded">${applyRoundingClient(item.charCount, st.rounding)}</td>
      <td class="col-mode">
        <select data-id="${escapeAttr(item.nodeId)}">
          <option value="none" ${st.rounding === 'none' ? 'selected' : ''}>None</option>
          <option value="down5" ${st.rounding === 'down5' ? 'selected' : ''}>Round down to nearest 5</option>
          <option value="up5" ${st.rounding === 'up5' ? 'selected' : ''}>Round up to nearest 5</option>
        </select>
      </td>
    `;
    tbody.appendChild(tr);
  }

  tbody.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener('change', () => {
      const id = cb.getAttribute('data-id') || '';
      const st = copy.rowState.get(id);
      if (st) st.selected = cb.checked;
      syncBulkSelectAll();
      renderPreview();
    });
  });
  tbody.querySelectorAll<HTMLSelectElement>('select').forEach((sel) => {
    sel.addEventListener('change', () => {
      const id = sel.getAttribute('data-id') || '';
      const st = copy.rowState.get(id);
      if (st) st.rounding = sel.value as RoundingMode;
      renderCountTable();
      renderPreview();
    });
  });
}

function applyRoundingClient(count: number, mode: RoundingMode): number {
  if (mode === 'down5') return Math.floor(count / 5) * 5;
  if (mode === 'up5') return Math.ceil(count / 5) * 5;
  return count;
}

function syncBulkSelectAll() {
  const cb = byId('bulk-select-all') as HTMLInputElement;
  const allSelected = copy.items.length > 0 && copy.items.every((item) => copy.rowState.get(item.nodeId)?.selected);
  cb.checked = allSelected;
}

function renderPreview() {
  const rows: PreviewRow[] = copy.items.map((item) => {
    const st = copy.rowState.get(item.nodeId) || { selected: true, rounding: 'none' as RoundingMode };
    return { item, selected: st.selected, rounding: st.rounding };
  });
  const text = buildPreview(rows, copy.format);
  (byId('preview-area') as HTMLTextAreaElement).value = text;
}

// ---------------------------------------------------------------------------
// Clipboard

async function onCopyNow() {
  const ta = byId('preview-area') as HTMLTextAreaElement;
  const text = ta.value;
  if (!text) {
    toast('Nothing to copy — select at least one row.');
    return;
  }
  const lines = text.split('\n').length;
  const btn = byId('copy-now-btn') as HTMLButtonElement;
  const originalLabel = btn.textContent;

  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
    } else {
      throw new Error('no-clipboard-api');
    }
    btn.textContent = 'Copied ✓';
    toast(`Copied ${lines} line${lines === 1 ? '' : 's'} to clipboard`);
    setTimeout(() => {
      btn.textContent = originalLabel || 'Copy now';
    }, 1500);
  } catch {
    try {
      ta.focus();
      ta.select();
      const ok = document.execCommand && document.execCommand('copy');
      if (ok) {
        btn.textContent = 'Copied ✓';
        toast(`Copied ${lines} line${lines === 1 ? '' : 's'} to clipboard`);
        setTimeout(() => {
          btn.textContent = originalLabel || 'Copy now';
        }, 1500);
      } else {
        throw new Error('exec-failed');
      }
    } catch {
      ta.focus();
      ta.select();
      toast("Couldn't copy automatically — preview is selected, press ⌘C.");
    }
  }
}

// ---------------------------------------------------------------------------
// Tiny DOM helpers

function byId(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element: ${id}`);
  return el;
}
function setText(id: string, text: string) {
  byId(id).textContent = text;
}
function show(id: string) {
  byId(id).classList.remove('hidden');
}
function hide(id: string) {
  byId(id).classList.add('hidden');
}
function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;'
  );
}
function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/\n/g, ' ');
}

let toastTimer: number | undefined;
function toast(message: string) {
  const el = byId('toast');
  el.textContent = message;
  el.classList.remove('hidden');
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    el.classList.add('hidden');
  }, 2200);
}

// ---------------------------------------------------------------------------
// User-driven resize. The grip in the bottom-right corner drags to set window
// size; we post the new dimensions to main.ts which calls figma.ui.resize.

const MIN_W = 320;
const MIN_H = 400;
const MAX_W = 1200;
const MAX_H = 1400;

function wireResizeGrip() {
  const grip = byId('resize-grip');
  let resizing = false;
  let rafPending = false;
  let pendingW = 0;
  let pendingH = 0;

  function flush() {
    rafPending = false;
    send({ type: 'resize', width: pendingW, height: pendingH });
  }

  grip.addEventListener('mousedown', (e) => {
    resizing = true;
    e.preventDefault();
    document.body.style.userSelect = 'none';
  });
  window.addEventListener('mousemove', (e) => {
    if (!resizing) return;
    pendingW = Math.max(MIN_W, Math.min(MAX_W, e.clientX + 8));
    pendingH = Math.max(MIN_H, Math.min(MAX_H, e.clientY + 8));
    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(flush);
    }
  });
  window.addEventListener('mouseup', () => {
    if (!resizing) return;
    resizing = false;
    document.body.style.userSelect = '';
  });
}
