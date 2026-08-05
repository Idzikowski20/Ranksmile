/**
 * Sidecar/LLM often closes </ul>/<ol> one item early and dumps the last bullet
 * as a sibling <p>. TipTap then shows a giant gap (list + paragraph margins).
 * Re-attach short list-like paragraphs into the preceding list.
 */

function looksLikeListContinuation(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t || t.length > 180) return false;

  const words = t.split(/\s+/).length;
  const startsLower = /^[a-ząćęłńóśźż]/.test(t);
  const startsQuote = /^["„«]/.test(t);
  const startsStrongLabel = /^<strong>/i.test(t) || /^\*\*/.test(t);
  const endsSemicolon = /;\s*$/.test(t);

  // Full prose sentences stay out (capitalized + longer).
  if (/^[A-ZĄĆĘŁŃÓŚŹŻ]/.test(t) && !startsQuote && words >= 8) return false;

  if (endsSemicolon) return true;
  if (startsQuote && words <= 24) return true;
  if (startsLower && words <= 18) return true;
  if (startsStrongLabel && words <= 20) return true;
  return false;
}

function paragraphInnerHtml(p: Element): string {
  return p.innerHTML.trim();
}

function paragraphPlain(p: Element): string {
  return (p.textContent || '').replace(/\s+/g, ' ').trim();
}

/** Merge orphan list-like <p> siblings after ul/ol back into the list. */
export function normalizeListHtml(html: string): string {
  const trimmed = (html || '').trim();
  if (!trimmed) return html;
  if (typeof DOMParser === 'undefined') return html;

  const doc = new DOMParser().parseFromString(
    `<div id="__rs_list_root">${trimmed}</div>`,
    'text/html',
  );
  const root = doc.getElementById('__rs_list_root');
  if (!root) return html;

  const lists = Array.from(root.querySelectorAll(':scope > ul, :scope > ol'));
  for (const list of lists) {
    let next = list.nextElementSibling;
    while (next && next.tagName === 'P' && looksLikeListContinuation(paragraphPlain(next))) {
      const li = doc.createElement('li');
      const inner = paragraphInnerHtml(next);
      // Keep paragraph wrapper — TipTap list items expect block content.
      li.innerHTML = inner.startsWith('<p') ? inner : `<p>${inner}</p>`;
      list.appendChild(li);
      const drop = next;
      next = next.nextElementSibling;
      drop.remove();
    }
  }

  return root.innerHTML;
}
