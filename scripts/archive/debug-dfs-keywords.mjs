#!/usr/bin/env node
/**
 * Debug DataForSEO keyword discovery for a URL + seed keyword.
 * Usage: node scripts/debug-dfs-keywords.mjs --url https://example.com/page --keyword "seed phrase"
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

for (const line of readFileSync(resolve(root, '.env'), 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const args = process.argv.slice(2);
const urlIdx = args.indexOf('--url');
const kwIdx = args.indexOf('--keyword');
const url = urlIdx >= 0 ? args[urlIdx + 1] : '';
const keyword = kwIdx >= 0 ? args[kwIdx + 1] : '';
const country = args.includes('--country') ? args[args.indexOf('--country') + 1] : 'PL';

if (!url || !keyword) {
  console.error('Usage: node scripts/debug-dfs-keywords.mjs --url <pageUrl> --keyword <seed> [--country PL]');
  process.exit(1);
}

const host = new URL(url).hostname.replace(/^www\./, '');
const auth = Buffer.from(`${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`).toString('base64');
const base = 'https://api.dataforseo.com/v3';

async function dfsPost(path, task) {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
    body: JSON.stringify([task]),
  });
  return res.json();
}

const loc = country === 'PL' ? 2616 : 2840;
const lang = country === 'PL' ? 'pl' : 'en';

console.log(`\n=== Ranked keywords: ${host} (${country}) ===`);
const ranked = await dfsPost('/dataforseo_labs/google/ranked_keywords/live', {
  target: host,
  location_code: loc,
  language_code: lang,
  limit: 80,
  order_by: ['keyword_data.keyword_info.search_volume,desc'],
  filters: [['ranked_serp_element.serp_item.rank_group', '<=', 15]],
});
const items = ranked?.tasks?.[0]?.result?.[0]?.items || [];
const seedWords = keyword.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
const onTopic = items.filter((i) => {
  const kw = (i.keyword_data?.keyword || '').toLowerCase();
  return seedWords.some((sw) => kw.includes(sw));
});
console.log(`Total: ${items.length}, on-topic (seed overlap): ${onTopic.length}`);
for (const i of onTopic.slice(0, 20)) {
  const kw = i.keyword_data?.keyword;
  const vol = i.keyword_data?.keyword_info?.search_volume;
  const pos = i.ranked_serp_element?.serp_item?.rank_absolute;
  console.log(`- ${kw} | pos: ${pos} | vol: ${vol}`);
}

console.log(`\n=== Suggestions: "${keyword}" ===`);
const sugg = await dfsPost('/dataforseo_labs/google/keyword_suggestions/live', {
  keyword: keyword.toLowerCase(),
  location_code: loc,
  language_code: lang,
  limit: 20,
});
const suggItems = sugg?.tasks?.[0]?.result?.[0]?.items || [];
for (const i of suggItems.slice(0, 12)) {
  console.log(`- ${i.keyword} | vol: ${i.keyword_info?.search_volume ?? '—'}`);
}

console.log('\nDone.\n');
