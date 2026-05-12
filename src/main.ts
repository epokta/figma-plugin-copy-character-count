// =============================================================================
// Copy character count — sandbox entry point.
//
// Lists the top-level frames on the current page and, on request, walks a
// single frame to produce a TextBoxCount[] (one entry per text node) that the
// UI uses to render the table, preview, and clipboard output. The plugin
// never mutates the document — it is read-only.
// =============================================================================

import { collect } from './count/collect';
import { FrameSummary, MainToUiMessage, UiToMainMessage } from './types';

// ---------------------------------------------------------------------------
// Bootstrap

figma.showUI(__html__, { width: 360, height: 560, themeColors: true });

figma.ui.onmessage = async (msg: UiToMainMessage) => {
  if (!msg || typeof msg !== 'object') return;
  switch (msg.type) {
    case 'resize':
      figma.ui.resize(360, Math.max(200, Math.min(900, Math.round(msg.height))));
      return;
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

// ---------------------------------------------------------------------------
// Copy-to-text: list frames & count one

async function listFrames() {
  const frames: FrameSummary[] = figma.currentPage.children
    .filter((n) => n.type === 'FRAME')
    .map((n) => ({ id: n.id, name: (n as FrameNode).name }));
  send({ type: 'frames', frames });
}

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
  const items = collect(frame as FrameNode, false);
  send({
    type: 'count-result',
    frameId,
    frameName: (frame as FrameNode).name,
    items,
  });
}
