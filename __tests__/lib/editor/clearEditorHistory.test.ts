/**
 * @jest-environment jsdom
 */
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import clearEditorHistory from '../../../lib/editor/clearEditorHistory';

const OUTLINE = '<h2>Kim jesteśmy</h2><p>Pokryj sekcję.</p>';
const ARTICLE = '<h2>Jak działa prywatny detektyw</h2><p>Napisany akapit.</p>';

function editorWith(html: string): Editor {
  return new Editor({ extensions: [StarterKit], content: html });
}

describe('clearEditorHistory', () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  /**
   * The generated article lands in a single `setContent`, which is one undoable step:
   * Ctrl+Z put the reviewed outline back and dropped the article, and autosave then wrote
   * the outline over it.
   */
  it('makes the generated article survive an undo', () => {
    editor = editorWith(OUTLINE);
    editor.commands.setContent(ARTICLE);
    expect(editor.getHTML()).toContain('Napisany akapit');

    clearEditorHistory(editor);
    editor.commands.undo();

    expect(editor.getHTML()).toContain('Napisany akapit');
    expect(editor.getHTML()).not.toContain('Kim jesteśmy');
  });

  /** Without the call the same undo walks back — the behaviour this guards against. */
  it('leaves undo working when it is not called', () => {
    editor = editorWith(OUTLINE);
    editor.commands.setContent(ARTICLE);
    editor.commands.undo();

    expect(editor.getHTML()).toContain('Kim jesteśmy');
  });

  it('keeps the document and tolerates a destroyed editor', () => {
    editor = editorWith(ARTICLE);
    clearEditorHistory(editor);
    expect(editor.getHTML()).toContain('Napisany akapit');

    const gone = editorWith(ARTICLE);
    gone.destroy();
    expect(() => clearEditorHistory(gone)).not.toThrow();
  });
});
