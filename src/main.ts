// =============================================================================
// Copy character count — sandbox entry point.
//
// Behaves like Figma's right inspector: whatever frame the user has selected
// (or has anything selected inside of) becomes the counted frame. Selection
// changes auto-update the panel — no in-plugin picker step. Read-only.
// =============================================================================

import { collect } from './count/collect';
import { MainToUiMessage, UiToMainMessage } from './types';

// Window size bounds — kept in sync with the UI's resize grip.
const MIN_W = 320;
const MIN_H = 400;
const MAX_W = 1200;
const MAX_H = 1400;

// Debounce selection-change so clicking around doesn't run an export per click.
const SELECTION_DEBOUNCE_MS = 150;

// ---------------------------------------------------------------------------
// Bootstrap

figma.showUI(__html__, { width: 600, height: 540, themeColors: true });

figma.ui.onmessage = async (msg: UiToMainMessage) => {
  if (!msg || typeof msg !== 'object') return;
  switch (msg.type) {
    case 'resize': {
      const w = clamp(Math.round(msg.width), MIN_W, MAX_W);
      const h = clamp(Math.round(msg.height), MIN_H, MAX_H);
      figma.ui.resize(w, h);
      return;
    }
    case 'refresh':
      await refreshFromSelection();
      return;
  }
};

function send(msg: MainToUiMessage) {
  figma.ui.postMessage(msg);
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

// ---------------------------------------------------------------------------
// Selection → frame

async function refreshFromSelection() {
  const selection = figma.currentPage.selection;
  let frame: FrameNode | null = null;
  for (const node of selection) {
    const candidate = findFrameAncestor(node);
    if (candidate) {
      frame = candidate;
      break;
    }
  }
  if (!frame) {
    send({ type: 'no-selection' });
    return;
  }
  const items = collect(frame, false);
  send({
    type: 'count-result',
    frameId: frame.id,
    frameName: frame.name,
    items,
  });
  // Best-effort preview. Width-constrained so the export stays small.
  try {
    const bytes = await frame.exportAsync({
      format: 'PNG',
      constraint: { type: 'WIDTH', value: 480 },
    });
    send({ type: 'frame-preview', frameId: frame.id, bytes });
  } catch {
    /* preview is non-essential; if export fails the UI just hides the image */
  }
}

// Walk up from a node to find the nearest FRAME ancestor. If the node itself
// is a FRAME, that's returned. Returns null if no FRAME is found (e.g. the
// node lives directly under a SECTION or under the page).
function findFrameAncestor(node: SceneNode): FrameNode | null {
  let current: BaseNode | null = node;
  while (current) {
    if (current.type === 'FRAME') return current as FrameNode;
    current = current.parent;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Auto-update on selection change.

let selectionTimer: ReturnType<typeof setTimeout> | undefined;
figma.on('selectionchange', () => {
  if (selectionTimer) clearTimeout(selectionTimer);
  selectionTimer = setTimeout(() => {
    selectionTimer = undefined;
    refreshFromSelection();
  }, SELECTION_DEBOUNCE_MS);
});

// Initial run on plugin open.
refreshFromSelection();
