import * as cheerio from 'cheerio';

/**
 * Replace base64 data-URL image sources with short placeholders before the HTML
 * reaches the LLM (those can be megabytes). Restore them on the way out.
 */
export function stripDataImages(html: string): { stripped: string; map: Map<string, string> } {
  const map = new Map<string, string>();
  let i = 0;
  const stripped = html.replace(/(<img[^>]*\ssrc=)["'](data:[^"']+)["']/gi, (_m, pre, dataUrl) => {
    const token = `__RANKSMILE_IMG_${i}__`;
    i += 1;
    map.set(token, dataUrl);
    return `${pre}"${token}"`;
  });
  return { stripped, map };
}

export function restoreDataImages(html: string, map: Map<string, string>): string {
  let out = html;
  map.forEach((dataUrl, token) => { out = out.split(token).join(dataUrl); });
  return out;
}

/** Remove the data-sid handles we inject for the model before saving the article. */
export function stripSids(html: string): string {
  return html.replace(/\s+data-sid="\d+"/g, '');
}

export interface WorkingDoc {
  $: cheerio.CheerioAPI;
  /** One line per top-level block: `[sid N] <tag> preview` */
  outline: string;
}

/**
 * PURE read: build the outline (one line per top-level block) from the sids that
 * are already on the document. No mutation — safe to call from read tools.
 */
export function buildOutline($: cheerio.CheerioAPI): string {
  const lines: string[] = [];
  $.root().children().each((_i, el) => {
    const sid = $(el).attr('data-sid');
    if (sid == null) return; // skip unindexed nodes (shouldn't happen post-reindex)
    const tag = (el as cheerio.Element).tagName || (el as { name?: string }).name || '?';
    const preview = $(el).text().replace(/\s+/g, ' ').trim().slice(0, 80);
    lines.push(`[sid ${sid}] <${tag}> ${preview}`);
  });
  return lines.join('\n');
}

/**
 * MUTATES: renumber every top-level block's `data-sid` to 0..n (contiguous), then
 * return the fresh outline. Call this only after a structural edit (or initial load).
 */
export function reindexSids($: cheerio.CheerioAPI): string {
  $.root().children().each((i, el) => { $(el).attr('data-sid', String(i)); });
  return buildOutline($);
}

/**
 * Load article HTML as a cheerio fragment and tag each top-level block with a
 * stable `data-sid` so tools can target it.
 */
export function makeWorkingDoc(html: string): WorkingDoc {
  const $ = cheerio.load(html, null, false); // fragment mode: no <html>/<body> wrapper
  const outline = reindexSids($);
  return { $, outline };
}

const UNSAFE_TAGS = 'script,style,iframe,object,embed,noscript,link,meta,base,form,input,button,svg';

/**
 * Defense-in-depth: strip dangerous tags/attributes from model-authored HTML
 * before it enters the article. (Tiptap's schema is a second backstop on apply.)
 */
export function sanitizeFragment(html: string): string {
  const $ = cheerio.load(html, null, false);
  $(UNSAFE_TAGS).remove();
  $('*').each((_i, el) => {
    const attribs = (el as cheerio.Element).attribs || {};
    Object.keys(attribs).forEach((name) => {
      if (/^on/i.test(name)) { $(el).removeAttr(name); return; }
      if ((name === 'href' || name === 'src') && /^\s*javascript:/i.test(attribs[name])) {
        $(el).removeAttr(name);
      }
    });
  });
  return $.root().html() || '';
}
