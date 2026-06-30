// AO-8a: pure helper for the "Accept all" / pre-save resolve-all command.
// Walks a ProseMirror document and returns every contentOptimizer node together
// with its position, sorted DESCENDING by position. Splicing from highest pos to
// lowest means each replacement never shifts the positions of the nodes still to
// be processed (earlier splices would otherwise invalidate later positions).

// Minimal structural shape of the bits of a ProseMirror node/doc we touch — keeps
// this helper editor-agnostic and unit-testable without booting a live TipTap editor.
export interface PMNodeLike {
   type: { name: string };
   nodeSize: number;
   attrs: { sectionId?: string; [k: string]: unknown };
}

export interface PMDocLike {
   descendants(fn: (node: PMNodeLike, pos: number) => void): void;
}

export interface OptimizerNodeRef {
   sectionId: string;
   pos: number;
   nodeSize: number;
}

/** Collect all contentOptimizer nodes in `doc`, sorted by position DESCENDING. */
export function collectOptimizerPositions(doc: PMDocLike): OptimizerNodeRef[] {
   const refs: OptimizerNodeRef[] = [];
   doc.descendants((node, pos) => {
      if (node.type.name === 'contentOptimizer') {
         refs.push({ sectionId: String(node.attrs.sectionId ?? ''), pos, nodeSize: node.nodeSize });
      }
   });
   // Highest position first so splices don't invalidate not-yet-processed positions.
   return refs.sort((a, b) => b.pos - a.pos);
}
