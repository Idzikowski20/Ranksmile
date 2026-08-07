/**
 * @jest-environment jsdom
 */
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {
  revealHtmlInEditor,
  splitHtmlTopLevelBlocks,
  editorCanCommand,
} from '../../../lib/editor/revealHtmlProgressive';

// jsdom implements neither, and the reveal calls both on every block.
Element.prototype.scrollIntoView = () => {};

describe('splitHtmlTopLevelBlocks', () => {
  it('splits sibling top-level tags', () => {
    const blocks = splitHtmlTopLevelBlocks('<h2>A</h2><p>one</p><h2>B</h2><p>two</p>');
    expect(blocks).toHaveLength(4);
    expect(blocks[0]).toContain('A');
    expect(blocks[2]).toContain('B');
  });

  it('returns empty for blank', () => {
    expect(splitHtmlTopLevelBlocks('   ')).toEqual([]);
  });

  it('keeps a single block intact', () => {
    const blocks = splitHtmlTopLevelBlocks('<h1>Only</h1>');
    expect(blocks).toEqual(['<h1>Only</h1>']);
  });
});

describe('editorCanCommand', () => {
  it('rejects null and destroyed editors', () => {
    expect(editorCanCommand(null)).toBe(false);
    expect(editorCanCommand(undefined)).toBe(false);
    expect(editorCanCommand({ isDestroyed: true } as never)).toBe(false);
    expect(editorCanCommand({ isDestroyed: false } as never)).toBe(true);
  });
});

/**
 * A reviewed outline: heading, its instruction bullets, its target-length line. Both
 * document-corrupting bugs the reveal has shipped only show up on shapes like this —
 * a list followed by more blocks.
 */
const OUTLINE = '<h1>Detektyw</h1>'
  + '<h2>Zakres uslug</h2><ul><li>Wyjasnij zakres</li><li>Cover: licencja</li></ul>'
  + '<p>Target length: ~300 words</p>'
  + '<h2>Cennik</h2><ul><li>Cover: stawki</li></ul>';

describe('revealHtmlInEditor document integrity', () => {
  let editor: Editor;

  beforeEach(() => { editor = new Editor({ extensions: [StarterKit], content: '' }); });
  afterEach(() => editor.destroy());

  /**
   * The reveal must be presentation-only. Building the document up block by block broke
   * it twice: `insertContent` inserts at the selection, which sits inside the last <li>
   * after a list, so every following section nested one level deeper; `insertContentAt`
   * with an HTML string appends a trailing empty paragraph per call, so a blank line
   * opened under every heading and every list.
   */
  it('leaves exactly the document a plain setContent would have produced', async () => {
    await revealHtmlInEditor(editor, OUTLINE);

    const expected = new Editor({ extensions: [StarterKit], content: '' });
    expected.commands.setContent(OUTLINE);
    expect(editor.getHTML()).toBe(expected.getHTML());
    expected.destroy();
  });

  it('nests nothing inside the list and inserts no empty paragraphs between blocks', async () => {
    await revealHtmlInEditor(editor, OUTLINE);

    // The single trailing paragraph is TipTap's own trailing-node guarantee, so only
    // empty paragraphs BETWEEN blocks indicate the reveal padded the document.
    const html = editor.getHTML().replace(/<p><\/p>$/, '');
    expect(html).not.toContain('<p></p>');
    // A heading swallowed by the preceding list is the nesting signature.
    expect(html).not.toMatch(/<li>(?:(?!<\/li>)[\s\S])*<h[1-4]/);
    expect(html.match(/<h2>/g)).toHaveLength(2);
  });

  it('clears the inline fade styles it applied', async () => {
    await revealHtmlInEditor(editor, OUTLINE);

    const styled = Array.from(editor.view.dom.children)
      .filter((el) => (el as HTMLElement).style.opacity !== '');
    expect(styled).toHaveLength(0);
  });

  /**
   * Aborting is a superseded or unmounted reveal, never a request to drop content: the
   * document is committed before the first frame, so a cancelled animation must still
   * leave a complete, fully visible article.
   */
  it('keeps the whole document visible when aborted mid-animation', async () => {
    const controller = new AbortController();
    const reveal = revealHtmlInEditor(editor, OUTLINE, { signal: controller.signal });
    controller.abort();
    await reveal;

    expect(editor.getHTML()).toContain('Cennik');
    const hidden = Array.from(editor.view.dom.children)
      .filter((el) => (el as HTMLElement).style.opacity === '0');
    expect(hidden).toHaveLength(0);
  });

  /**
   * `hide()` parks every block at opacity 0 and the loop shows block 0 in the same
   * synchronous pass. Without a forced style recalculation in between, the browser never
   * paints the hidden state, no transition starts, and block 0 pops in while the rest
   * fade. jsdom does no layout, so the observable is the layout read itself — it has to
   * happen while a block is still parked.
   */
  it('forces a style recalculation between hiding the blocks and showing the first', async () => {
    const seenOpacities: string[] = [];
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get(this: HTMLElement) {
        seenOpacities.push(this.style.opacity);
        return 0;
      },
    });

    try {
      await revealHtmlInEditor(editor, OUTLINE);
    } finally {
      if (original) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', original);
    }

    expect(seenOpacities).toContain('0');
  });

  /**
   * Reveal B supersedes reveal A: ProseMirror reuses the DOM nodes, so A's abort cleanup
   * used to strip the inline styles off the blocks B had just parked — the new article
   * appeared all at once instead of fading.
   */
  it('does not clear the styles of the reveal that superseded it', async () => {
    const first = new AbortController();
    const second = new AbortController();
    const revealA = revealHtmlInEditor(editor, OUTLINE, { signal: first.signal });
    const revealB = revealHtmlInEditor(editor, OUTLINE, { signal: second.signal });

    // ProseMirror reconciles the DOM on its own between ticks, so the surviving inline
    // styles are not a stable observable here — the unstyling itself is.
    const removed = jest.spyOn(CSSStyleDeclaration.prototype, 'removeProperty');
    first.abort();
    await revealA;
    const cleared = removed.mock.calls.map(([prop]) => prop);
    removed.mockRestore();

    expect(cleared).toHaveLength(0);

    second.abort();
    await revealB;
  });

  it('clears the document for empty html', async () => {
    await revealHtmlInEditor(editor, '   ');
    expect(editor.getText()).toBe('');
  });
});
