// UI-side logic for the Copy character count panel.
// Runs inside the plugin's iframe; talks to main.ts via parent.postMessage /
// window.onmessage. Clipboard access lives here (the sandbox can't reach it).

import { buildPreview, PreviewRow } from './count/format';
import {
  CountFormat,
  FrameSummary,
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
  frames: FrameSummary[];
  search: string;
  chosenFrameId: string | null;
  chosenFrameName: string;
  items: TextBoxCount[];
  rowState: Map<string, { selected: boolean; rounding: RoundingMode }>;
  format: CountFormat;
  warning: string | null;
}

const copy: CopyState = {
  frames: [],
  search: '',
  chosenFrameId: null,
  chosenFrameName: '',
  items: [],
  rowState: new Map(),
  format: 'plain',
  warning: null,
};

// ---------------------------------------------------------------------------
// Boot

document.addEventListener('DOMContentLoaded', () => {
  wireCopy();
  // Request the frame list so the picker is populated as soon as the panel opens.
  send({ type: 'list-frames' });
});

// ---------------------------------------------------------------------------
// Incoming messages

window.onmessage = (event: MessageEvent) => {
  const msg = event.data && (event.data.pluginMessage as MainToUiMessage);
  if (!msg) return;
  switch (msg.type) {
    case 'frames':
      onFrames(msg.frames);
      return;
    case 'count-result':
      onCountResult(msg.frameId, msg.frameName, msg.items);
      return;
  }
};

// ---------------------------------------------------------------------------
// Copy panel wiring

function wireCopy() {
  (byId('frame-search') as HTMLInputElement).addEventListener('input', (e) => {
    copy.search = (e.target as HTMLInputElement).value.toLowerCase();
    renderFrameList();
  });
  byId('use-selection-btn').addEventListener('click', () => {
    // Ask main to list frames; user picks from the surfaced list.
    send({ type: 'list-frames' });
  });
  byId('change-frame-btn').addEventListener('click', () => {
    copy.chosenFrameId = null;
    copy.items = [];
    copy.rowState.clear();
    copy.warning = null;
    show('frame-picker');
    hide('frame-chosen');
    send({ type: 'list-frames' });
  });

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

function onFrames(frames: FrameSummary[]) {
  copy.frames = frames;
  // If we're already viewing a chosen frame, check that it's still there.
  if (copy.chosenFrameId) {
    const stillThere = frames.find((f) => f.id === copy.chosenFrameId);
    if (!stillThere) {
      copy.warning = 'The chosen frame was deleted. Pick another.';
      showFrameWarning();
    } else if (stillThere.name !== copy.chosenFrameName) {
      copy.chosenFrameName = stillThere.name;
      setText('chosen-frame-name', stillThere.name);
    }
  }
  if (copy.chosenFrameId === null) {
    show('frame-picker');
    hide('frame-chosen');
  }
  renderFrameList();
}

function renderFrameList() {
  const list = byId('frame-list');
  list.innerHTML = '';
  const filtered = copy.frames.filter((f) =>
    !copy.search || f.name.toLowerCase().includes(copy.search)
  );
  if (copy.frames.length === 0) {
    show('no-frames-state');
    return;
  }
  hide('no-frames-state');
  for (const f of filtered) {
    const btn = document.createElement('button');
    btn.className = 'frame-item';
    btn.textContent = f.name;
    btn.addEventListener('click', () => pickFrame(f.id, f.name));
    list.appendChild(btn);
  }
}

function pickFrame(id: string, name: string) {
  copy.chosenFrameId = id;
  copy.chosenFrameName = name;
  copy.warning = null;
  setText('chosen-frame-name', name);
  setText('chosen-frame-sub', 'Loading text layers…');
  hide('frame-picker');
  show('frame-chosen');
  send({ type: 'count-frame', frameId: id });
}

function onCountResult(frameId: string, frameName: string, items: TextBoxCount[]) {
  if (copy.chosenFrameId !== frameId) {
    // Stale response — ignore.
    return;
  }
  copy.chosenFrameName = frameName || copy.chosenFrameName;
  setText('chosen-frame-name', copy.chosenFrameName);
  copy.items = items;
  copy.rowState.clear();
  for (const item of items) {
    copy.rowState.set(item.nodeId, { selected: true, rounding: 'none' });
  }
  setText(
    'chosen-frame-sub',
    `${items.length} text layer${items.length === 1 ? '' : 's'}`
  );
  // Reset bulk controls.
  (byId('bulk-select-all') as HTMLInputElement).checked = true;
  (byId('bulk-rounding') as HTMLSelectElement).value = 'none';
  renderCountTable();
  renderPreview();
}

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
      <td class="cell-label" title="${escapeAttr(item.label)}\n${escapeAttr(item.text)}">${escapeHtml(item.label)}</td>
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
      // Update just this row's rounded count.
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
  const allSelected = copy.items.every((item) => copy.rowState.get(item.nodeId)?.selected);
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

function showFrameWarning() {
  const el = byId('frame-warning');
  if (!copy.warning) {
    el.classList.add('hidden');
    el.textContent = '';
    return;
  }
  el.classList.remove('hidden');
  el.textContent = copy.warning;
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
    // Fallback: select textarea + execCommand.
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
