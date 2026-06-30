import { useEffect, useImperativeHandle, forwardRef } from 'react';
import { useEditor, EditorContent, ReactNodeViewRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import ImageExt from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import Highlight from '@tiptap/extension-highlight';
import { TableKit } from '@tiptap/extension-table';
import Typography from '@tiptap/extension-typography';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { TextStyle, Color } from '@tiptap/extension-text-style';
import { Details, DetailsSummary, DetailsContent } from '@tiptap/extension-details';
import Youtube from '@tiptap/extension-youtube';
import SurferImageNode from './SurferImageNode';

export type ViewerEditorHandle = {
  /** Replace the rendered doc with new HTML (no history, no events). Preserves scroll. */
  setContent: (html: string) => void;
  /** Screen coords of a ProseMirror position, for the ghost caret. */
  coordsAtPos: (pos: number) => { left: number; top: number; bottom: number } | null;
  /** Current doc size, to clamp incoming caret positions. */
  docSize: () => number;
};

type Props = { initialHtml: string };

/**
 * Read-only mirror of the author's editor. Same CONTENT extensions so the doc (and
 * thus ProseMirror positions) round-trip; authoring-only extensions are omitted.
 * Parsing untrusted HTML through the schema also strips scripts / event handlers /
 * unknown nodes — sanitization for free.
 */
const ViewerEditor = forwardRef<ViewerEditorHandle, Props>(({ initialHtml }, ref) => {
  const SurferImage = ImageExt.extend({
    addNodeView() {
      return ReactNodeViewRenderer(SurferImageNode);
    },
  });

  const editor = useEditor({
    editable: false,
    immediatelyRender: false,
    content: initialHtml,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4] }, link: false }),
      SurferImage.configure({ inline: false, allowBase64: true, HTMLAttributes: { class: 'article-image' } }),
      TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right', 'justify'] }),
      Link.configure({ openOnClick: false, autolink: false, HTMLAttributes: { rel: 'noopener noreferrer' } }),
      Highlight.configure({ multicolor: true }),
      TableKit.configure({ table: { resizable: false } }),
      Typography,
      TaskList,
      TaskItem.configure({ nested: true }),
      Subscript,
      Superscript,
      TextStyle,
      Color,
      Details.configure({ persist: true, HTMLAttributes: { class: 'art-details' } }),
      DetailsSummary,
      DetailsContent,
      Youtube.configure({ width: 640, height: 360, nocookie: true, HTMLAttributes: { class: 'art-youtube' } }),
    ],
  });

  useImperativeHandle(ref, () => ({
    setContent: (html: string) => {
      if (!editor) return;
      // Preserve scroll across the doc swap so the viewer doesn't jump/flicker.
      const scrollEl = document.scrollingElement || document.documentElement;
      const prevTop = scrollEl.scrollTop;
      editor.commands.setContent(html, { emitUpdate: false });
      requestAnimationFrame(() => { scrollEl.scrollTop = prevTop; });
    },
    coordsAtPos: (pos: number) => {
      if (!editor) return null;
      try {
        const clamped = Math.max(0, Math.min(pos, editor.state.doc.content.size));
        const c = editor.view.coordsAtPos(clamped);
        return { left: c.left, top: c.top, bottom: c.bottom };
      } catch { return null; }
    },
    docSize: () => editor?.state.doc.content.size ?? 0,
  }), [editor]);

  // Keep mounted content in sync if the parent swaps initialHtml (e.g. refetch).
  useEffect(() => {
    if (editor && initialHtml && editor.getHTML() !== initialHtml) {
      editor.commands.setContent(initialHtml, { emitUpdate: false });
    }
  }, [initialHtml, editor]);

  return <EditorContent editor={editor} className="preview-prose" />;
});

ViewerEditor.displayName = 'ViewerEditor';
export default ViewerEditor;
