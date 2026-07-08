import type { Editor } from '@tiptap/core';

/** Imperative handle exposed by ArticleEditor via editorRef prop. */
export interface ArticleEditorHandle {
   getEditor: () => Editor | null;
   triggerSurfy?: (prompt: string) => void;
   toggleSurfy?: () => void;
}
