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

/**
 * Where the next block goes: the end of the document, unless the document is still just
 * the placeholder paragraph ProseMirror's schema requires — then the range covering
 * that paragraph, so the first block replaces it instead of landing underneath it.
 */
function trailingEmptyRange(editor: Editor): number | { from: number; to: number } {
  const { doc } = editor.state;
  const end = doc.content.size;
  const last = doc.lastChild;
  if (doc.childCount === 1 && last && last.type.name === 'paragraph' && last.content.size === 0) {
    return { from: 0, to: end };
  }
  return end;
}

function animateLastBlock(editor: Editor): void {
  if (prefersReducedMotion() || !editorCanCommand(editor)) return;
  const last = editor.view?.dom?.lastElementChild as HTMLElement | null;
  if (!last) return;
  last.style.opacity = '0';
  last.style.transform = 'translateY(8px)';
  void last.offsetHeight;
  last.style.transition =
    'opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1), transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)';
  last.style.opacity = '1';
  last.style.transform = 'translateY(0)';
}

export type RevealHtmlOptions = {
  signal?: AbortSignal;
  /** `preserve` keeps partial content for an explicit user cancellation. */
  abortBehavior?: 'complete' | 'preserve';
  /** Final emitUpdate (default true). Intermediate inserts use emitUpdate false when possible. */
  emitUpdate?: boolean;
};

/** Append top-level HTML blocks one-by-one with a soft entrance. */
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

  if (prefersReducedMotion() || blocks.length === 1) {
    editor.commands.setContent(html, { emitUpdate: emit });
    return;
  }

  const delayMs = Math.max(55, Math.min(180, Math.floor(2800 / blocks.length)));
  editor.commands.setContent('', { emitUpdate: false });

  try {
    for (let i = 0; i < blocks.length; i++) {
      if (opts?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      assertEditorLive(editor);
      // Append without remounting prior blocks (keeps fade on the newest node only).
      //
      // Explicitly at the end of the doc, never `insertContent`: that inserts at the
      // current selection, and after a <ul> the selection sits INSIDE the last <li>.
      // Every following block then landed inside that list item — headings and lists
      // nesting one level deeper per section, which is what turned a reviewed outline
      // into a single runaway bullet list.
      //
      // `setContent('')` leaves the schema's required empty paragraph behind, so the
      // first block replaces it rather than appending after it — otherwise every reveal
      // opened with a blank line above the H1.
      editor.commands.insertContentAt(trailingEmptyRange(editor), blocks[i]);
      animateLastBlock(editor);
      const last = editor.view?.dom?.lastElementChild;
      last?.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      if (i < blocks.length - 1) await sleep(delayMs, opts?.signal);
    }
    // insertContent already emits updates; no final setContent (would remount and kill fades).
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      // Unmount / supersede: never touch destroyed editor (root cause of null.commands).
      if (opts?.abortBehavior !== 'preserve' && editorCanCommand(editor)) {
        editor.commands.setContent(html, { emitUpdate: emit });
      }
      return;
    }
    throw e;
  }
}
