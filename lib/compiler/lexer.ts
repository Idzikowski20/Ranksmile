import type { CompileSource, LexToken, TipTapNode } from './types';

function nextId(n: { i: number }): string {
  n.i += 1;
  return `b${n.i}`;
}

function textOf(node: TipTapNode): string {
  if (node.type === 'hardBreak') return '\n';
  if (node.text) return node.text;
  if (!node.content) return '';
  return node.content.map(textOf).join('');
}

function walkTipTap(nodes: readonly TipTapNode[], out: LexToken[], ctr: { i: number }): void {
  for (const node of nodes) {
    const type = node.type ?? 'other';
    if (type === 'heading') {
      const levelRaw = Number(node.attrs?.level ?? 1);
      const headingLevel = (levelRaw >= 1 && levelRaw <= 4 ? levelRaw : 1) as 1 | 2 | 3 | 4;
      out.push({
        kind: 'heading',
        text: textOf(node).trim(),
        headingLevel,
        blockId: nextId(ctr),
      });
      continue;
    }
    if (type === 'paragraph') {
      const text = textOf(node).trim();
      if (text.length > 0) {
        out.push({ kind: 'paragraph', text, blockId: nextId(ctr) });
      }
      continue;
    }
    if (type === 'listItem' || type === 'list_item') {
      const text = (node.content ?? [])
        .filter((child) => child.type !== 'bulletList' && child.type !== 'orderedList')
        .map(textOf)
        .join('')
        .trim();
      if (text) out.push({ kind: 'list_item', text, blockId: nextId(ctr) });
      for (const child of node.content ?? []) {
        if (child.type === 'bulletList' || child.type === 'orderedList') {
          walkTipTap(child.content ?? [], out, ctr);
        }
      }
      continue;
    }
    if (type === 'bulletList' || type === 'orderedList' || type === 'doc') {
      if (node.content) walkTipTap(node.content, out, ctr);
      continue;
    }
    const text = textOf(node).trim();
    if (text.length > 0) {
      out.push({ kind: 'other', text, blockId: nextId(ctr) });
    } else if (node.content) {
      walkTipTap(node.content, out, ctr);
    }
  }
}

function lexPlain(text: string): readonly LexToken[] {
  const ctr = { i: 0 };
  const chunks = text.replace(/\r\n/g, '\n').split(/\n{2,}/);
  const out: LexToken[] = [];
  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    const headingMatch = /^(#{1,4})\s+(.+)$/m.exec(trimmed);
    if (headingMatch && trimmed === headingMatch[0]) {
      const level = headingMatch[1].length as 1 | 2 | 3 | 4;
      out.push({
        kind: 'heading',
        text: headingMatch[2].trim(),
        headingLevel: level,
        blockId: nextId(ctr),
      });
      continue;
    }
    // multi-line chunk: first line heading, rest paragraph
    const lines = trimmed.split('\n');
    const first = lines[0] ?? '';
    const hm = /^(#{1,4})\s+(.+)$/.exec(first);
    if (hm) {
      const level = hm[1].length as 1 | 2 | 3 | 4;
      out.push({
        kind: 'heading',
        text: hm[2].trim(),
        headingLevel: level,
        blockId: nextId(ctr),
      });
      const rest = lines.slice(1).join('\n').trim();
      if (rest) {
        out.push({ kind: 'paragraph', text: rest, blockId: nextId(ctr) });
      }
      continue;
    }
    out.push({ kind: 'paragraph', text: trimmed, blockId: nextId(ctr) });
  }
  return out;
}

/** Lexer: plain text or TipTap JSON → LexTokens with stable blockIds. No HTML parsers. */
export function lex(source: CompileSource): readonly LexToken[] {
  if (source.kind === 'plain') return lexPlain(source.text);
  const root = source.doc;
  const content = root.type === 'doc' && root.content ? root.content : [root];
  const out: LexToken[] = [];
  walkTipTap(content, out, { i: 0 });
  return out;
}
