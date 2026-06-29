import * as cheerio from 'cheerio';

// Tags that must never survive into rendered article HTML. Mirrors lib/ai/workingDoc.ts'
// sanitizeFragment but is the shared, render-boundary sanitizer for ANY stored article body
// (auto-optimize / ask-surfy / import / AI generation all write raw model/scraped HTML to the DB).
const UNSAFE_TAGS = 'script,style,iframe,object,embed,noscript,link,meta,base,form,input,button,textarea,select,svg';

/**
 * Allowlist-style cleanup of stored article HTML before it is rendered (esp. on the public,
 * unauthenticated share page, which injects it via dangerouslySetInnerHTML). Strips active-content
 * tags, every on* event handler, and javascript:/data:text-html in href/src — while preserving
 * normal prose, headings, lists, links, tables and <img> (incl. data: image sources).
 */
export function sanitizeArticleHtml(html: string): string {
  if (!html) return '';
  const $ = cheerio.load(html, null, false); // fragment mode — no <html>/<body> wrapper
  $(UNSAFE_TAGS).remove();
  $('*').each((_i, el) => {
    const attribs = (el as cheerio.Element).attribs || {};
    Object.keys(attribs).forEach((name) => {
      const val = attribs[name];
      if (/^on/i.test(name)) { $(el).removeAttr(name); return; }
      if (name === 'href' || name === 'src' || name === 'xlink:href') {
        const v = (val || '').trim();
        // Block javascript: and data:text/html (script-bearing); keep data:image/* for inline images.
        if (/^javascript:/i.test(v) || /^data:text\/html/i.test(v)) $(el).removeAttr(name);
      }
      if (name === 'srcset') $(el).removeAttr(name); // can smuggle data:text/html candidates
    });
  });
  return $.root().html() || '';
}
