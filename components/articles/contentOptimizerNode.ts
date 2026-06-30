import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import ContentOptimizerNodeView from './ContentOptimizerNodeView';

// TipTap node that wraps one changed article section for the Accept/Reject review
// flow. Atom = true so the entire block is treated as a single unit; the
// orchestration layer is responsible for suspending autosave while these nodes
// exist in the document (this node is NEVER persisted into the saved article).
const ContentOptimizer = Node.create({
  name: 'contentOptimizer',

  group: 'block',
  atom: true,
  selectable: false,
  draggable: false,

  addAttributes() {
    return {
      sectionId: { default: '' },
      status: { default: 'pending' },
      oldHtml: { default: '' },
      newHtml: { default: '' },
      index: { default: 0 },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-content-optimizer]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-content-optimizer': '' }, HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ContentOptimizerNodeView);
  },
});

export { ContentOptimizer };
export default ContentOptimizer;
