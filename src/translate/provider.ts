// Translation provider interface — every provider (demo, DeepL, Google, OpenAI)
// implements this. Keep it minimal so swapping providers is a one-line change.

import { TargetLang, Translation } from '../types';

export interface TranslationProvider {
  /** Translate a batch of strings to the target language. */
  translate(strings: string[], targetLang: TargetLang): Promise<Translation[]>;
}
