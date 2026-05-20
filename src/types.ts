// Shared types used by both the sandbox (main.ts) and the UI (ui.ts).
// Keep this file framework-free so it can be imported from either side.

export type RoundingMode = 'none' | 'down5' | 'up5';
export type CountFormat = 'plain' | 'markdown' | 'keyvalue';

export interface TextBoxCount {
  nodeId: string;
  label: string;
  text: string;
  charCount: number;
}

export interface FrameSummary {
  id: string;
  name: string;
  // Optional: path of sections the frame lives in, e.g. ["Benefits", "Login"].
  // Empty/undefined for frames at the page root.
  path?: string[];
}

// UI -> Main messages
export type UiToMainMessage =
  | { type: 'resize'; width: number; height: number }
  | { type: 'list-frames' }
  | { type: 'count-frame'; frameId: string };

// Main -> UI messages
export type MainToUiMessage =
  | { type: 'frames'; frames: FrameSummary[] }
  | {
      type: 'count-result';
      frameId: string;
      frameName: string;
      items: TextBoxCount[];
    }
  | { type: 'frame-preview'; frameId: string; bytes: Uint8Array };
