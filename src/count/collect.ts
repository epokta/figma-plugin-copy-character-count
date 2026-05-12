// Walk a frame and return TextBoxCount[] — one entry per TEXT descendant.
// Runs in the sandbox (main.ts) because it needs SceneNode access.
import { TextBoxCount } from '../types';
import { graphemeCount } from './format';

export function collect(frame: FrameNode | SceneNode, includeHidden = false): TextBoxCount[] {
  const out: TextBoxCount[] = [];
  walk(frame, includeHidden, out);
  return out;
}

function walk(node: SceneNode, includeHidden: boolean, out: TextBoxCount[]) {
  if (!includeHidden && 'visible' in node && node.visible === false) return;

  if (node.type === 'TEXT') {
    const textNode = node as TextNode;
    const raw = typeof textNode.characters === 'string' ? textNode.characters : '';
    out.push({
      nodeId: textNode.id,
      label: pickLabel(textNode, raw),
      text: raw,
      charCount: graphemeCount(raw),
    });
    return;
  }

  if ('children' in node) {
    for (const child of node.children) {
      walk(child, includeHidden, out);
    }
  }
}

function pickLabel(node: TextNode, text: string): string {
  // Use the layer name if it looks meaningful, else fall back to a snippet of the text.
  const name = (node.name || '').trim();
  if (name && !looksLikeDefaultName(name)) return name;
  const snippet = text.trim().slice(0, 40);
  return snippet || name || 'Text';
}

function looksLikeDefaultName(name: string): boolean {
  // Figma's default text layer name is the text content itself, which is fine.
  // But generic names like "Text", "Text 1", "Text 12" are not meaningful.
  return /^text(\s*\d+)?$/i.test(name);
}
