import { EditorState } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/react';

/**
 * Drops the undo stack, keeping the document that is on screen.
 *
 * A generated article replaces the reviewed outline in one `setContent`, and that is a
 * single undoable step: one Ctrl+Z after a finished generation put the outline back and
 * threw the article away — the editor then autosaved the outline over it. There is no
 * "undo the generation" to offer, because the article is only in the document; the answer
 * is that the write is not undoable at all.
 *
 * ProseMirror keeps history in plugin state, so it clears by rebuilding the state from the
 * current doc — the plugins are re-initialised, the document and the caret are not.
 */
export default function clearEditorHistory(editor: Editor): void {
  if (!editor || editor.isDestroyed) return;
  const { state, view } = editor;
  view.updateState(EditorState.create({
    doc: state.doc,
    selection: state.selection,
    storedMarks: state.storedMarks,
    plugins: state.plugins,
  }));
}
