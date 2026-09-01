export type ResolveOp = 'insert' | 'delete';

/**
 * Which editor op resolves a content-optimizer suggestion node for the chosen side.
 *
 * An empty chosen side is a real outcome, not a no-op: accepting a section deletion
 * (newHtml empty) or undoing a section addition (oldHtml empty) both mean "remove this
 * node". Any HTML means replace the node with it.
 */
export function resolveNodeOp(html: string): ResolveOp {
  return html ? 'insert' : 'delete';
}
