// =============================================================================
// Copy character count — sandbox entry point.
//
// Lists frames on the current page (including frames nested inside Sections)
// and, on request, walks a single frame to produce a TextBoxCount[] (one entry
// per text node) that the UI uses to render the table, preview, and clipboard
// output. Also exports a small PNG preview of the chosen frame so the UI can
// show a thumbnail. The plugin never mutates the document — it is read-only.
// =============================================================================

import { collect } from './count/collect';
import { FrameSummary, MainToUiMessage, UiToMainMessage } from './types';

// Window size bounds — kept in sync with the UI's resize grip.
const MIN_W = 320;
const MIN_H = 400;
const MAX_W = 1200;
const MAX_H = 1400;

// ---------------------------------------------------------------------------
// Bootstrap

figma.showUI(__html__, { width: 360, height: 560, themeColors: true });

figma.ui.onmessage = async (msg: UiToMainMessage) => {
  if (!msg || typeof msg !== 'object') return;
  switch (msg.type) {
    case 'resize': {
      const w = clamp(Math.round(msg.width), MIN_W, MAX_W);
      const h = clamp(Math.round(msg.height), MIN_H, MAX_H);
      figma.ui.resize(w, h);
      return;
    }
    case 'list-frames':
      await listFrames();
      return;
    case 'count-frame':
      await countFrame(msg.frameId);
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
// Frame discovery — walks into Sections so frames nested inside sections are
// findable. Stops at frames (doesn't recurse into nested frames, which are
// usually component parts rather than standalone screens).

async function listFrames() {
  const frames: FrameSummary[] = [];
  collectFrames(figma.currentPage as unknown as { children: readonly SceneNode[] }, frames, []);
  send({ type: 'frames', frames });
}

function collectFrames(
  parent: { children?: readonly SceneNode[] },
  out: FrameSummary[],
  path: string[]
) {
  if (!parent.children) return;
  for (const child of parent.children) {
    if (child.type === 'FRAME') {
      out.push({
        id: child.id,
        name: (child as FrameNode).name,
        path: path.length > 0 ? path.slice() : undefined,
      });
    } else if (child.type === 'SECTION') {
      const section = child as SectionNode;
      collectFrames(section, out, [...path, section.name]);
    }
  }
}

// ---------------------------------------------------------------------------
// Count a frame's text layers and send a preview thumbnail.

async function countFrame(frameId: string) {
  let frame: BaseNode | null = null;
  try {
    if (typeof (figma as any).getNodeByIdAsync === 'function') {
      frame = await (figma as any).getNodeByIdAsync(frameId);
    } else {
      frame = figma.getNodeById(frameId);
    }
  } catch {
    frame = null;
  }
  if (!frame || frame.type !== 'FRAME') {
    figma.notify('That frame is no longer available. Pick another.');
    send({ type: 'count-result', frameId, frameName: '', items: [] });
    return;
  }

  const frameNode = frame as FrameNode;
  const items = collect(frameNode, false);
  send({
    type: 'count-result',
    frameId,
    frameName: frameNode.name,
    items,
  });

  // Best-effort preview. Width-constrained so the export stays small.
  try {
    const bytes = await frameNode.exportAsync({
      format: 'PNG',
      constraint: { type: 'WIDTH', value: 480 },
    });
    send({ type: 'frame-preview', frameId, bytes });
  } catch {
    /* preview is non-essential; if export fails the UI just hides the image */
  }
}
