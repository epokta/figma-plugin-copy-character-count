// Shared types used by both the sandbox (main.ts) and the UI (ui.ts).
// Keep this file framework-free so it can be imported from either side.

export type RoundingMode = 'none' | 'down5' | 'up5';
export type CountFormat = 'plain' | 'markdown' | 'keyvalue';
export type TargetLang = 'de' | 'ar' | 'es';

export interface TextBoxCount {
  nodeId: string;
  label: string;
  text: string;
  charCount: number;
}

export interface Translation {
  source: string;
  translation: string;
}

// UI -> Main messages
export type UiToMainMessage =
  | { type: 'resize'; width: number; height: number }
  | { type: 'refresh' }
  | { type: 'translate'; strings: string[]; targetLang: TargetLang };

// Main -> UI messages
export type MainToUiMessage =
  | { type: 'no-selection' }
  | {
      type: 'count-result';
      frameId: string;
      frameName: string;
      items: TextBoxCount[];
    }
  | { type: 'frame-preview'; frameId: string; bytes: Uint8Array }
  | {
      type: 'translations';
      targetLang: TargetLang;
      translations: Translation[];
    }
  | { type: 'translation-error'; message: string };
