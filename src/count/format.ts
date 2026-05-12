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

// Build the clipboard preview string from the user's per-row choices.
export function buildPreview(rows: PreviewRow[], format: CountFormat): string {
  const selected = rows.filter((r) => r.selected);
  if (selected.length === 0) return '';

  // Disambiguate duplicate labels by appending the text snippet.
  const labelCounts = new Map<string, number>();
  for (const r of selected) {
    labelCounts.set(r.item.label, (labelCounts.get(r.item.label) || 0) + 1);
  }

  const lines: string[] = [];
  for (const r of selected) {
    const rounded = applyRounding(r.item.charCount, r.rounding);
    let label = r.item.label;
    if ((labelCounts.get(label) || 0) > 1) {
      const snippet = r.item.text.trim().slice(0, 24);
      if (snippet && snippet !== label) label = `${label} (${snippet})`;
    }
    lines.push(formatLine(label, rounded, format));
  }
  return lines.join('\n');
}

function formatLine(label: string, count: number, format: CountFormat): string {
  switch (format) {
    case 'markdown':
      return `- ${label}: ${count} chars`;
    case 'keyvalue':
      return `${label}: ${count}`;
    case 'plain':
    default:
      return `${label}: ${count} chars`;
  }
}

export function countSelectedLines(rows: PreviewRow[]): number {
  return rows.filter((r) => r.selected).length;
}
