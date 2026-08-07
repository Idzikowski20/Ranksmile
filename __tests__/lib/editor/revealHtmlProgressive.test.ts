/**
 * @jest-environment jsdom
 */
import {
  revealHtmlInEditor,
  splitHtmlTopLevelBlocks,
  editorCanCommand,
} from '../../../lib/editor/revealHtmlProgressive';

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
 * `insertContent` inserts at the current selection, and after a <ul> the selection sits
 * inside the last <li>. Every following block then landed inside that list item, so an
 * outline nested one level deeper per section until it read as one runaway bullet list.
 * Blocks must be appended at the end of the document instead.
 */
it('appends each block at the end of the doc, not at the cursor', async () => {
  const insertContentAt = jest.fn();
  const insertContent = jest.fn();

  await revealHtmlInEditor({
    isDestroyed: false,
    state: { doc: { content: { size: 42 } } },
    view: { dom: {} },
    commands: { setContent: jest.fn(), insertContent, insertContentAt },
  } as never, '<h2>A</h2><ul><li>one</li></ul><h2>B</h2><ul><li>two</li></ul>');

  expect(insertContent).not.toHaveBeenCalled();
  expect(insertContentAt).toHaveBeenCalledTimes(4);
  expect(insertContentAt.mock.calls.every(([pos]) => pos === 42)).toBe(true);
});

/** Editors without a readable doc size still have to render something. */
it('falls back to insertContent when the doc size is unavailable', async () => {
  const insertContent = jest.fn();
  const insertContentAt = jest.fn();

  await revealHtmlInEditor({
    isDestroyed: false,
    view: { dom: {} },
    commands: { setContent: jest.fn(), insertContent, insertContentAt },
  } as never, '<h2>A</h2><p>one</p>');

  expect(insertContentAt).not.toHaveBeenCalled();
  expect(insertContent).toHaveBeenCalledTimes(2);
});

it('does not flush the complete article when an explicit cancellation aborts reveal', async () => {
  const setContent = jest.fn();
  const controller = new AbortController();
  controller.abort();

  await revealHtmlInEditor({
    isDestroyed: false,
    commands: { setContent, insertContent: jest.fn() },
  } as never, '<h2>One</h2><p>Two</p>', {
    signal: controller.signal,
    abortBehavior: 'preserve',
  });

  expect(setContent).toHaveBeenCalledWith('', { emitUpdate: false });
  expect(setContent).not.toHaveBeenCalledWith('<h2>One</h2><p>Two</p>', expect.anything());
});
