import * as cheerio from 'cheerio';

// Attributes worth keeping per tag; everything else (class, style, data-*, the
// TipTap editor cruft) is stripped so the plugin's Gutenberg parser stays clean.
const KEEP_ATTRS: Record<string, Set<string>> = {
   a: new Set(['href', 'target', 'rel', 'title']),
   img: new Set(['src', 'alt', 'title', 'width', 'height']),
};

const WRAPPERS = 'div, section, article, header, footer, main, aside, span';

/**
 * Normalise our editor HTML into the flat block structure the WordPress plugin's
 * Gutenberg parser understands. The parser only emits blocks for a fixed tag set
 * (p, h1-6, ul, ol, img, blockquote, pre, hr, table) and silently drops anything
 * else, so we: lift images out of paragraphs (→ image blocks, not inline), unwrap
 * structural wrappers (div/section/figure incl. our FAQ markup), drop empty nodes
 * and editor cruft.
 */
export function cleanHtmlForWordPress(html: string): string {
   if (!html || !html.trim()) return '';
   const $ = cheerio.load(html);
   const $body = $('body');

   // 1. Drop non-content + comments.
   $body.find('script, style, noscript').remove();
   $body.find('*').contents().filter((_, n) => n.type === 'comment').remove();

   // 2. <figure> → its <img> (captions/wrappers dropped). If the figure wraps
   //    non-image content (e.g. a table or code block), unwrap it rather than drop
   //    it — losing the whole block would silently delete real content.
   $body.find('figure').each((_, el) => {
      const img = $(el).find('img').first();
      if (img.length) $(el).replaceWith($.html(img)); else $(el).replaceWith($(el).contents());
   });

   // 3. Lift <img> out of <p> (→ after the paragraph) and out of lists (→ after the
   //    whole <ul>/<ol>, never left inside it) so they become standalone image blocks.
   $body.find('li img').each((_, el) => {
      const $img = $(el);
      const $list = $img.closest('ul, ol');
      const outer = $.html($img);
      $img.remove();
      if ($list.length) $list.after(outer);
   });
   $body.find('p img').each((_, el) => {
      const $img = $(el);
      const $p = $img.closest('p');
      const outer = $.html($img);
      $img.remove();
      $p.after(outer);
   });

   // 4. Unwrap structural wrappers the parser skips (repeat for nested FAQ divs).
   for (let pass = 0; pass < 25 && $body.find(WRAPPERS).length; pass += 1) {
      $body.find(WRAPPERS).each((_, el) => { $(el).replaceWith($(el).contents()); });
   }

   // 5. Remove empty paragraphs / headings (keep ones that still hold an image).
   $body.find('p, h1, h2, h3, h4, h5, h6').each((_, el) => {
      if (!$(el).text().trim() && $(el).find('img').length === 0) $(el).remove();
   });

   // 6. Strip every attribute except the per-tag whitelist.
   $body.find('*').each((_, el) => {
      if (el.type !== 'tag') return;
      const keep = KEEP_ATTRS[el.name] || new Set<string>();
      Object.keys(el.attribs || {}).forEach((name) => { if (!keep.has(name)) $(el).removeAttr(name); });
   });

   return ($body.html() || '').trim();
}
