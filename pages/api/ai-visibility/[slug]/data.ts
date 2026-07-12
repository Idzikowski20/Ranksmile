import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../../utils/verifyDomainOwnership';
import { ensureAiVisibilityTables } from '../../../../lib/ensureAiVisibilityTables';
import { getErrorMessage } from '../../../../lib/errors';
import { queryOne, queryRows } from '../../../../lib/db/query';
import { aggregateSources, buildSnapshotsForScan, rankCompetitors, snapshotForDomain, computeDelta, computeOverview, domainMentionGap, domainGapCandidates, brandsForSource, competitorPrompts, sourceMentions, groupFanoutByQuery, groupFanoutByPrompt, commonPhrases, ResultRow, DomainSnapshot } from '../../../../lib/aiVisibilityMetrics';
import { parseCitations as parseCitationsShared, loadScanResultRows, getDisplayScan, getPreviousDisplayScan } from '../../../../lib/aiVisibilityRead';
import { refreshIntervalDays } from '../../../../lib/aiVisibility';

// Compare never renders a competitor's Sources → drop them to bound the payload.
const withoutSources = (s: DomainSnapshot): DomainSnapshot => ({ ...s, sources: [] });
const NORM = (d: string): string => d.toLowerCase().replace(/^www\./, '');

type DbResultRow = {
   prompt_id: number, model: string, own_cited: number, own_position: number | null,
   citations: unknown, topic: string, text: string,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   await ensureAiVisibilityTables();
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
   const userId = await getCurrentUserId(req, res);
   const ownership = await verifyDomainOwnershipBySlug(req.query.slug as string, userId);
   if (ownership === false) return res.status(403).json({ error: 'Access denied.' });
   if (ownership === null) return res.status(404).json({ error: 'Domain not found' });
   const domain = ownership as unknown as { ID: number, domain: string };
   const view = String(req.query.view || 'overview');

   try {
      const display = await getDisplayScan(domain.ID);
      if (!display) return res.status(200).json({ pending: true });
      const scan = display.scan;

      // Brand-aware views (sources/source-detail) load full ResultRows (incl. brands) and
      // support prompt/model filtering via CSV query params.
      const cfg = await queryOne<{ brand_name: string, priority: string | null }>(
         'SELECT c.brand_name, c.priority FROM ai_vis_configs c WHERE c.domain_id = ? ORDER BY c.id DESC LIMIT 1', [domain.ID],
      );
      const ownBrand = cfg?.brand_name || domain.domain;
      const parseIds = (v: unknown): number[] => (typeof v === 'string' && v ? v.split(',').map((x) => parseInt(x, 10)).filter((n) => !Number.isNaN(n)) : []);
      const parseList = (v: unknown): string[] => (typeof v === 'string' && v ? v.split(',').filter(Boolean) : []);
      const filterRows = (rs: ResultRow[]): ResultRow[] => {
         const pids = parseIds(req.query.prompts); const models = parseList(req.query.models);
         return rs.filter((r) => (!pids.length || pids.includes(r.promptId)) && (!models.length || models.includes(r.model)));
      };

      if (view === 'sources') {
         const all = filterRows(await loadScanResultRows(scan.id));
         // Mention Gap compares the tracked DOMAIN against competitor DOMAINS by
         // prompt-citation overlap (not brand names extracted from answers).
         const candidates = domainGapCandidates(all, domain.domain);
         const wanted = parseList(req.query.gapBrands);
         const selected = wanted.length ? wanted : candidates.slice(0, 4);

         // Compare mode: sources cited on prompts where the chosen competitor is cited
         // (the gap sources), with own-brand-mention flag per source.
         const compareParam = typeof req.query.compare === 'string' ? NORM(req.query.compare) : '';
         let compareSources: unknown;
         if (compareParam) {
            const cited = (d: string): boolean => d === compareParam || d.endsWith(`.${compareParam}`);
            const compPrompts = new Set(all.filter((r) => r.citations.some((c) => cited(NORM(c.domain)))).map((r) => r.promptId));
            const urlPrompts = new Map<string, Set<number>>();
            for (const r of all) for (const c of r.citations) {
               const set = urlPrompts.get(c.url) ?? new Set<number>();
               set.add(r.promptId); urlPrompts.set(c.url, set);
            }
            compareSources = aggregateSources(all, ownBrand)
               .filter((s) => { const ps = urlPrompts.get(s.url); return !!ps && Array.from(ps).some((id) => compPrompts.has(id)); })
               .map((s) => ({ ...s, compMentioned: true }));
         }

         return res.status(200).json({
            sources: aggregateSources(all, ownBrand),
            gapCards: selected.map((d) => domainMentionGap(all, d, domain.domain)),
            gapCandidates: candidates,
            ownLabel: NORM(domain.domain),
            compareSources,
            compareLabel: compareParam || undefined,
         });
      }

      if (view === 'source-detail') {
         const url = typeof req.query.url === 'string' ? req.query.url : '';
         if (!url) return res.status(200).json({ history: [], brands: [], brandCount: 0 });
         const scans = await queryRows<{ id: number, finished_at: string | null }>(
            `SELECT s.id, s.finished_at FROM ai_vis_scans s JOIN ai_vis_configs c ON c.id = s.config_id
             WHERE c.domain_id = ? AND s.status = 'completed' ORDER BY s.id DESC LIMIT 24`, [domain.ID],
         );
         const history: Array<{ finishedAt: string | null, timesShown: number }> = [];
         for (const s of scans.slice().reverse()) {
            const rs = filterRows(await loadScanResultRows(s.id));
            history.push({ finishedAt: s.finished_at, timesShown: rs.reduce((acc, r) => acc + r.citations.filter((c) => c.url === url).length, 0) });
         }
         const latest = filterRows(await loadScanResultRows(scan.id));
         const brands = brandsForSource(latest, url);
         return res.status(200).json({ history, brands, brandCount: brands.length });
      }

      if (view === 'fanout') {
         // Fan-out sub-queries the engines generated on the latest scan, grouped two
         // ways + the common-phrase pills. Honors the prompt/model toolbar filters.
         const all = filterRows(await loadScanResultRows(scan.id));
         return res.status(200).json({
            groupByFanout: groupFanoutByQuery(all),
            groupByPrompt: groupFanoutByPrompt(all),
            commonPhrases: commonPhrases(all),
         });
      }

      if (view === 'prompt-detail' || view === 'fanout-detail') {
         // Shared detail slide-over. prompt-detail scopes to one prompt; fanout-detail
         // scopes to every prompt that produced the given fan-out query. `engine` (the
         // modal's model dropdown) further narrows the rows; metrics are the OWNER's.
         const engine = typeof req.query.engine === 'string' ? req.query.engine : '';
         const promptId = parseInt(String(req.query.promptId), 10);
         const query = typeof req.query.query === 'string' ? req.query.query : '';
         const entity = (rs: ResultRow[]): ResultRow[] => (view === 'prompt-detail'
            ? rs.filter((r) => r.promptId === promptId)
            // Scope directly to rows that actually emitted this query, so the modal's
            // engines/overview/trend never include models that never produced it.
            : rs.filter((r) => (r.fanOutQueries ?? []).includes(query)));
         const scope = (rs: ResultRow[]): ResultRow[] => { const e = entity(rs); return engine ? e.filter((r) => r.model === engine) : e; };

         const latestAll = await loadScanResultRows(scan.id);
         const entityRows = entity(latestAll); // unscoped-by-engine → drives the engine dropdown + title
         if (!entityRows.length) return res.status(200).json({ pending: false, title: query, overview: null, engines: [], series: [], brands: [], fanout: [] });
         const scoped = engine ? entityRows.filter((r) => r.model === engine) : entityRows;
         const overview = computeOverview(scoped);

         const engines = Array.from(new Set(entityRows.map((r) => r.model)));

         // Time series over recent completed scans (bounded like /history).
         const scans = await queryRows<{ id: number, finished_at: string | null }>(
            `SELECT s.id, s.finished_at FROM ai_vis_scans s JOIN ai_vis_configs c ON c.id = s.config_id
             WHERE c.domain_id = ? AND s.status = 'completed' ORDER BY s.id DESC LIMIT 24`, [domain.ID]);
         const series: Array<{ finishedAt: string | null, visibilityScore: number, mentionRate: number, avgPosition: number | null }> = [];
         for (const s of scans.slice().reverse()) {
            const ov = computeOverview(s.id === scan.id ? scoped : scope(await loadScanResultRows(s.id)));
            series.push({ finishedAt: s.finished_at, visibilityScore: ov.visibilityScore, mentionRate: ov.mentionRate, avgPosition: ov.avgPosition });
         }

         // Brands recognised across the scoped rows (mention count + avg appearance pos).
         const brandMap = new Map<string, { brand: string, domain: string, mentions: number, posSum: number }>();
         for (const r of scoped) for (const b of r.brands) {
            const key = b.brand.toLowerCase();
            const e = brandMap.get(key) ?? { brand: b.brand, domain: b.domain, mentions: 0, posSum: 0 };
            e.mentions += 1; e.posSum += b.pos; if (!e.domain && b.domain) e.domain = b.domain;
            brandMap.set(key, e);
         }
         const brands = Array.from(brandMap.values())
            .map((b) => ({ brand: b.brand, domain: b.domain, mentions: b.mentions, avgPosition: Math.round((b.posSum / b.mentions) * 10) / 10 }))
            .sort((a, b) => b.mentions - a.mentions);

         const fanout = view === 'prompt-detail'
            ? (groupFanoutByPrompt(scoped).find((p) => p.id === promptId)?.queries ?? [])
            : groupFanoutByQuery(scoped).filter((f) => f.query === query).map((f) => ({ query: f.query, models: f.models, timesShown: f.timesShown }));

         return res.status(200).json({
            title: view === 'prompt-detail' ? (entityRows[0]?.text || '') : query,
            overview: { visibilityScore: overview.visibilityScore, mentionRate: overview.mentionRate, avgPosition: overview.avgPosition },
            engines,
            series,
            brands,
            fanout,
         });
      }

      const dbRows = await queryRows<DbResultRow>(
         `SELECT r.prompt_id, r.model, r.own_cited, r.own_position, r.citations, p.topic, p.text
          FROM ai_vis_results r JOIN ai_vis_prompts p ON p.id = r.prompt_id
          WHERE r.scan_id = ? AND r.error IS NULL`,
         [scan.id],
      );
      const rows: ResultRow[] = dbRows.map((r) => ({
         promptId: r.prompt_id,
         model: r.model,
         ownCited: !!r.own_cited,
         ownPosition: r.own_position,
         citations: parseCitationsShared(r.citations),
         topic: r.topic,
         text: r.text,
         brands: [], // competitors/prompts branches don't read brands; B3 uses loadScanResultRows for sources
         fanOutQueries: [], // fanout view loads via loadScanResultRows (which selects the column)
      }));

      if (view === 'overview') {
         const own = domain.domain;
         const ownKey = NORM(own);
         const all = filterRows(rows); // scope own + competitor metrics to the picked prompts
         const byDomain = buildSnapshotsForScan(all, own);
         const ownSnap = byDomain.get(ownKey) ?? snapshotForDomain(all, own);
         const ranked = rankCompetitors(byDomain, own);

         const competitors = ranked.slice(0, 5).map((c) => ({ domain: c.domain, snapshot: withoutSources(c.snapshot) }));
         const competitorsAll = ranked.map((c) => ({ domain: c.domain, visibilityScore: c.snapshot.overview.visibilityScore }));

         // Long-tail: a picker choice outside the top-5. Reuse the already-computed map.
         const wanted = typeof req.query.competitor === 'string' ? NORM(req.query.competitor) : '';
         const compare = wanted && byDomain.has(wanted) && !competitors.some((c) => c.domain === wanted)
            ? { competitorDomain: wanted, snapshot: withoutSources(byDomain.get(wanted) as DomainSnapshot) } : null;

         // "Previous" = the completed scan that finished before this one (chronology
         // by finished_at, NOT id — a retry may have a higher id but earlier finish).
         const prev = scan.finished_at
            ? await getPreviousDisplayScan(domain.ID, scan.finished_at)
            : undefined;
         const delta = prev ? computeDelta(ownSnap, snapshotForDomain(filterRows(await loadScanResultRows(prev.id)), own)) : null;

         // Next automatic refresh = last finish + cadence; days until (clamped ≥ 0).
         const refreshDays = refreshIntervalDays(cfg?.priority);
         const nextRefreshAt = scan.finished_at
            ? new Date(new Date(scan.finished_at).getTime() + refreshDays * 86_400_000).toISOString()
            : null;
         const daysUntilRefresh = nextRefreshAt
            ? Math.max(0, Math.ceil((new Date(nextRefreshAt).getTime() - Date.now()) / 86_400_000))
            : null;

         // Picker options come from the UNFILTERED scan so a prompt filter never
         // shrinks the list you can pick from (the snapshot above is filtered).
         const promptOptions = Array.from(
            new Map(rows.map((r) => [r.promptId, { id: r.promptId, text: r.text, topic: r.topic }])).values(),
         );

         return res.status(200).json({
            scanId: scan.id,
            finishedAt: scan.finished_at,
            usingFallbackScan: display.usingFallbackScan,
            latestAttemptFailedAt: display.usingFallbackScan ? display.latestAttemptFinishedAt : null,
            snapshot: ownSnap,
            competitors,
            competitorsAll,
            compare,
            delta,
            previousScanAt: prev ? prev.finished_at : null,
            nextRefreshAt,
            daysUntilRefresh,
            refreshIntervalDays: refreshDays,
            priority: cfg?.priority ?? 'supporting',
            promptOptions,
         });
      }
      if (view === 'competitors') {
         // SurferSEO-style ranking: every cited competitor DOMAIN with its full
         // overview metrics, sorted by visibility desc. Respects prompt/model filters.
         const all = filterRows(await loadScanResultRows(scan.id));
         const byDomain = buildSnapshotsForScan(all, domain.domain);
         const ranked = rankCompetitors(byDomain, domain.domain);
         return res.status(200).json({
            competitors: ranked.map((c) => ({
               domain: c.domain,
               visibilityScore: c.snapshot.overview.visibilityScore,
               mentionRate: c.snapshot.overview.mentionRate,
               avgPosition: c.snapshot.overview.avgPosition,
            })),
         });
      }
      if (view === 'competitor-detail') {
         const comp = typeof req.query.competitor === 'string' ? req.query.competitor : '';
         if (!comp) return res.status(400).json({ error: 'competitor required' });
         const all = filterRows(await loadScanResultRows(scan.id));
         const snap = snapshotForDomain(all, comp);
         const sources = snap.sources.filter((s) => s.domain === NORM(comp));
         // Brand name derived from the competitor domain (matches extracted brand names
         // for most cases, e.g. www.squarespace.com → "Squarespace").
         const base = NORM(comp).split('.')[0];
         const brand = base ? base.charAt(0).toUpperCase() + base.slice(1) : comp;
         const ms = sourceMentions(all, ownBrand, brand);
         return res.status(200).json({
            overview: { visibilityScore: snap.overview.visibilityScore, mentionRate: snap.overview.mentionRate, avgPosition: snap.overview.avgPosition },
            prompts: competitorPrompts(all, comp),
            sources,
            brand,
            ownLabel: NORM(domain.domain),
            mentions: ms.length,
            mentionSources: ms.map((s) => ({ url: s.url, domain: s.domain, timesShown: s.timesShown, ownMentioned: s.aMentioned, compMentioned: s.bMentioned })),
            gap: domainMentionGap(all, comp, domain.domain),
         });
      }
      if (view === 'prompt-topics') {
         // Topic-grouped prompts for the tracked domain: per-prompt + per-topic
         // visibility / mention rate / avg position, plus the brand favicon stack.
         const all = filterRows(await loadScanResultRows(scan.id));
         const brandDomains = (rows2: ResultRow[]): string[] => {
            const set = new Set<string>();
            for (const r of rows2) for (const b of r.brands) if (b.domain) set.add(NORM(b.domain));
            return Array.from(set);
         };
         const byPrompt = new Map<number, ResultRow[]>();
         for (const r of all) { const l = byPrompt.get(r.promptId) ?? []; l.push(r); byPrompt.set(r.promptId, l); }
         const promptMeta = new Map<number, { topic: string, text: string }>();
         for (const r of all) if (!promptMeta.has(r.promptId)) promptMeta.set(r.promptId, { topic: r.topic, text: r.text });
         const byTopic = new Map<string, ResultRow[]>();
         for (const r of all) { const l = byTopic.get(r.topic) ?? []; l.push(r); byTopic.set(r.topic, l); }

         const topics = Array.from(byTopic.entries()).map(([topic, topicRows]) => {
            const ov = computeOverview(topicRows);
            const promptIds = Array.from(new Set(topicRows.map((r) => r.promptId)));
            const prompts = promptIds.map((id) => {
               const pr = byPrompt.get(id) || [];
               const pov = computeOverview(pr);
               return { id, text: promptMeta.get(id)?.text || '', visibility: pov.visibilityScore, mentionRate: pov.mentionRate, avgPosition: pov.avgPosition, brands: brandDomains(pr) };
            });
            return { topic, promptCount: prompts.length, visibility: ov.visibilityScore, mentionRate: ov.mentionRate, avgPosition: ov.avgPosition, brands: brandDomains(topicRows), prompts };
         }).sort((a, b) => b.visibility - a.visibility);

         const overall = computeOverview(all);
         return res.status(200).json({
            overview: { visibilityScore: overall.visibilityScore, mentionRate: overall.mentionRate, avgPosition: overall.avgPosition },
            topics,
         });
      }
      if (view === 'prompts') {
         const byPrompt = new Map<number, { id: number, topic: string, text: string, perModel: Array<{ model: string, cited: boolean, position: number | null }> }>();
         for (const r of dbRows) {
            const entry = byPrompt.get(r.prompt_id) ?? { id: r.prompt_id, topic: r.topic, text: r.text, perModel: [] };
            entry.perModel.push({ model: r.model, cited: !!r.own_cited, position: r.own_position });
            byPrompt.set(r.prompt_id, entry);
         }
         const prompts = Array.from(byPrompt.values()).map((p) => {
            const scores = p.perModel.map((m) => (m.cited && m.position ? Math.max(0, 100 - (m.position - 1) * 15) : 0));
            const score = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
            return { ...p, score };
         }).sort((a, b) => b.score - a.score);
         return res.status(200).json({ prompts });
      }
      return res.status(400).json({ error: `Unknown view: ${view}` });
   } catch (error) {
      return res.status(500).json({ error: getErrorMessage(error) || 'Data fetch failed' });
   }
}
