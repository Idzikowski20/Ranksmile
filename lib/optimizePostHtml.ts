import { optimizeStore } from '../components/articles/optimizeStore';

const decodeAttr = (v: string) => v
  .replace(/&quot;/g, '"')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>');

/** Substitute contentOptimizer placeholders with the HTML that should count toward live scoring. */
export function substituteOptimizerPlaceholders(html: string): string {
  return html.replace(
    /<div\b[^>]*\bdata-content-optimizer\b[^>]*>[\s\S]*?<\/div>/gi,
    (tag) => {
      const idMatch = tag.match(/data-section-id="([^"]*)"/i);
      const statusMatch = tag.match(/data-status="([^"]*)"/i);
      const sid = decodeAttr(idMatch?.[1] ?? '');
      const status = statusMatch?.[1] ?? 'improved';
      const entry = optimizeStore.get(sid);
      if (!entry) return '';
      if (status === 'rejected') return entry.oldHtml;
      if (status === 'accepted') return entry.newHtml;
      if (!entry.changed) return entry.oldHtml;
      return entry.newHtml;
    },
  );
}
