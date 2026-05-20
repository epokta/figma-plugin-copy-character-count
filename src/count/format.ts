// Format module: grapheme counting + rounding + preview-string building.
// Pure functions, safe to import from both UI and sandbox.
import { CountFormat, RoundingMode, TextBoxCount } from '../types';

// Count by Unicode grapheme clusters so emoji like 👨‍👩‍👧 count as 1.
export function graphemeCount(text: string): number {
  if (!text) return 0;
  // Intl.Segmenter is available in modern browsers (Figma uses Chromium).
  const Seg = (globalThis as any).Intl && (Intl as any).Segmenter;
  if (typeof Seg === 'function') {
    try {
      const seg = new Seg(undefined, { granularity: 'grapheme' });
      let n = 0;
      // @ts-ignore - segment is iterable
      for (const _ of seg.segment(text)) n++;
      return n;
    } catch {
      /* fall through */
    }
  }
  // Fallback: Array.from splits by code point, which still merges surrogate pairs
  // but doesn't merge ZWJ sequences. Good enough for the fallback path.
  return Array.from(text).length;
}

export function applyRounding(count: number, mode: RoundingMode): number {
  if (mode === 'down5') return Math.floor(count / 5) * 5;
  if (mode === 'up5') return Math.ceil(count / 5) * 5;
  return count;
}

export interface PreviewRow {
  item: TextBoxCount;
  rounding: RoundingMode;
  selected: boolean;
}

// Collapse whitespace, trim, and truncate text so each output row stays single-line.
// Used both by the table UI and by the clipboard preview so what you see is what
// you copy.
export function displayText(text: string, maxLen = 60): string {
  const single = text.replace(/\s+/g, ' ').trim();
  if (!single) return '(empty)';
  if (single.length <= maxLen) return single;
  return single.slice(0, maxLen) + '…';
}

// Build the clipboard preview string from the user's per-row choices.
// Uses the actual text content (truncated) as the line identifier, not the
// layer name — so the export reads like the text the designer wrote.
export function buildPreview(rows: PreviewRow[], format: CountFormat): string {
  const selected = rows.filter((r) => r.selected);
  if (selected.length === 0) return '';

  const lines: string[] = [];
  for (const r of selected) {
    const rounded = applyRounding(r.item.charCount, r.rounding);
    const text = displayText(r.item.text);
    lines.push(formatLine(text, rounded, format));
  }
  return lines.join('\n');
}

function formatLine(text: string, count: number, format: CountFormat): string {
  switch (format) {
    case 'markdown':
      return `- ${text}: ${count} chars`;
    case 'keyvalue':
      return `${text}: ${count}`;
    case 'plain':
    default:
      return `${text}: ${count} chars`;
  }
}

export function countSelectedLines(rows: PreviewRow[]): number {
  return rows.filter((r) => r.selected).length;
}
