/**
 * Progressive HTML reveal in TipTap — block-by-block fade/slide (Ask Smily feel).
 * Not a live LLM stream; plays finished HTML so outlines/articles don't pop in at once.
 */
import type { Editor } from '@tiptap/core';
import { prefersReducedMotion } from '../motion/gsap';

export function splitHtmlTopLevelBlocks(html: string): string[] {
  const trimmed = (html || '').trim();
  if (!trimmed) return [];
  if (typeof DOMParser === 'undefined') return [trimmed];
  const doc = new DOMParser().parseFromString(
    `<div id="__rs_reveal_root">${trimmed}</div>`,
    'text/html',
  );
  const root = doc.getElementById('__rs_reveal_root');
  if (!root) return [trimmed];
  const blocks = Array.from(root.children).map((el) => el.outerHTML);
  return blocks.length > 0 ? blocks : [trimmed];
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const t = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** TipTap after destroy: accessing .commands throws (null internal). Treat as abort. */
export function editorCanCommand(editor: Editor | null | undefined): editor is Editor {
  return Boolean(editor && !editor.isDestroyed);
}

function assertEditorLive(editor: Editor): void {
  if (!editorCanCommand(editor)) {
    throw new DOMException('Aborted', 'AbortError');
  }
}

const TRANSITION_MS = 350;
const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';
const TRANSITION = `opacity ${TRANSITION_MS}ms ${EASE}, transform ${TRANSITION_MS}ms ${EASE}`;

/** Park a rendered block off-screen so it can be faded in on its turn. */
function hide(elements: HTMLElement[], index: number): void {
  const { style } = elements[index];
  style.opacity = '0';
  style.transform = 'translateY(8px)';
}

function show(elements: HTMLElement[], index: number): void {
  const { style } = elements[index];
  style.transition = TRANSITION;
  style.opacity = '1';
  style.transform = 'translateY(0)';
}

/** Drop the inline styles again so the document is left exactly as ProseMirror rendered it. */
function clearInlineMotion(elements: HTMLElement[]): void {
  for (const { style } of elements) {
    style.removeProperty('opacity');
    style.removeProperty('transform');
    style.removeProperty('transition');
  }
}

export type RevealHtmlOptions = {
  signal?: AbortSignal;
  /**
   * Retained for callers; both values now leave the full document in place. The reveal
   * is presentation-only, so aborting it can no longer truncate content.
   */
  abortBehavior?: 'complete' | 'preserve';
  /** Whether the single setContent emits an update (default true). */
  emitUpdate?: boolean;
};

/**
 * Fade the article in block by block (Ask Smily feel).
 *
 * The document is written ONCE with `setContent` and the animation only touches inline
 * styles on the already-rendered elements. Building it up with repeated inserts is what
 * produced both structural bugs we shipped: `insertContent` inserts at the selection —
 * which sits inside the last <li> after a list — so each section nested one level
 * deeper, and `insertContentAt` with an HTML string appends a trailing empty paragraph
 * per call, leaving a blank line after every heading and every list. `setContent`
 * parses the whole fragment in one pass and has neither problem.
 */
export async function revealHtmlInEditor(
  editor: Editor,
  html: string,
  opts?: RevealHtmlOptions,
): Promise<void> {
  const emit = opts?.emitUpdate !== false;
  const blocks = splitHtmlTopLevelBlocks(html);

  assertEditorLive(editor);

  if (!blocks.length) {
    editor.commands.setContent('', { emitUpdate: emit });
    return;
  }

  editor.commands.setContent(html, { emitUpdate: emit });

  if (prefersReducedMotion() || blocks.length === 1) return;

  const elements = Array.from(editor.view?.dom?.children ?? []) as HTMLElement[];
  if (elements.length < 2) return;

  const delayMs = Math.max(55, Math.min(180, Math.floor(2800 / elements.length)));
  elements.forEach((_, i) => hide(elements, i));

  try {
    for (let i = 0; i < elements.length; i += 1) {
      if (opts?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      assertEditorLive(editor);
      show(elements, i);
      elements[i].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      // The last block gets the full transition instead of the stagger gap, so the
      // cleanup below cannot cut its fade short.
      await sleep(i < elements.length - 1 ? delayMs : TRANSITION_MS, opts?.signal);
    }
  } catch (e) {
    if (!(e instanceof DOMException) || e.name !== 'AbortError') throw e;
    // Unmount / supersede: the content is already committed, so there is nothing to
    // restore — just make sure no block is left parked at opacity 0.
  } finally {
    clearInlineMotion(elements);
  }
}
