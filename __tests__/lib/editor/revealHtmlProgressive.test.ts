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
