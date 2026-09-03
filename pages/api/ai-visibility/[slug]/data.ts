import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../../utils/verifyDomainOwnership';
import { ensureAiVisibilityTables } from '@/src/infrastructure/persistence/schema/ensureAiVisibilityTables';
import { getErrorMessage } from '@/src/core/shared/errors';
import { queryOne, queryRows } from '@/src/infrastructure/db/query';
import { aggregateSources, buildSnapshotsForScan, rankCompetitors, rankBrandProfiles, snapshotForDomain, computeDelta, computeOverview, computeBrandOverview, withBrandHeadline, brandOverviewForDomain, domainMentionGap, domainGapCandidates, brandsForSource, competitorPrompts, sourceMentions, groupFanoutByQuery, groupFanoutByPrompt, commonPhrases, ResultRow, DomainSnapshot } from '@/src/core/domain/aiVisibility/metrics';
import { loadScanResultRows, loadScanRows, getDisplayScan, getPreviousDisplayScan } from '@/src/infrastructure/aiVisibility/aiVisibilityRead';
import { refreshIntervalDays } from '@/src/core/domain/aiVisibility/config';
import { withOrgPaymentAccess } from '@/src/infrastructure/billing/requireOrgPaymentAccess';

// Compare never renders a competitor's Sources → drop them to bound the payload.
const withoutSources = (s: DomainSnapshot): DomainSnapshot => ({ ...s, sources: [] });
const NORM = (d: string): string => d.toLowerCase().replace(/^www\./, '');

async function handler(req: NextApiRequest, res: NextApiResponse) {
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
      // Rows are scored against the brand their scan ran under; the config's current name
      // is only the fallback for scans recorded before the column existed.
      const scanBrand = scan.brand_name || ownBrand;
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

         // Enrich with what the "reading sources" phase actually found on each page: the
         // real <title>, the HTTP status, and whether the page itself names our brand.
         // Additive — rows the phase has not reached yet are returned unchanged.
         const verified = await queryRows<{
            url: string; title: string | null; http_status: number | null; own_mentioned: number | null; fetched_at: string | null;
         }>(
            'SELECT url, title, http_status, own_mentioned, fetched_at FROM ai_vis_sources WHERE scan_id = ?',
            [scan.id],
         );
         const verifiedByUrl = new Map(verified.map((v) => [v.url, v]));
         const sources = aggregateSources(all, ownBrand).map((s) => {
            const v = verifiedByUrl.get(s.url);
            // A row exists as soon as the URL is queued; only fetched_at proves the page was
            // read. Reporting `false` for a merely queued page would tell the user we
            // checked and found nothing.
            if (!v || !v.fetched_at) return s;
            return {
               ...s,
               title: v.title ?? undefined,
               httpStatus: v.http_status ?? undefined,
               pageMentionsBrand: v.own_mentioned === 1,
            };
         });

         return res.status(200).json({
            sources,
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
         // Same brand metric as the prompt row this modal was opened from, so the two agree.
         const overview = computeBrandOverview(scoped, ownBrand);

         const engines = Array.from(new Set(entityRows.map((r) => r.model)));

         // Time series over recent completed scans (bounded like /history).
         const scans = await queryRows<{ id: number, finished_at: string | null }>(
            `SELECT s.id, s.finished_at FROM ai_vis_scans s JOIN ai_vis_configs c ON c.id = s.config_id
             WHERE c.domain_id = ? AND s.status = 'completed' ORDER BY s.id DESC LIMIT 24`, [domain.ID]);
         const series: Array<{ finishedAt: string | null, visibilityScore: number, mentionRate: number, avgPosition: number | null }> = [];
         for (const s of scans.slice().reverse()) {
            const ov = computeBrandOverview(s.id === scan.id ? scoped : scope(await loadScanResultRows(s.id)), ownBrand);
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

      if (view === 'overview') {
         const rows = await loadScanRows(scan.id);
         const own = domain.domain;
         const ownKey = NORM(own);
         const all = filterRows(rows); // scope own + competitor metrics to the picked prompts
         // The cards are keyed by domain; their score is the brand the answers name for that
         // site, so an entry reads the same here as it does on Competitors. A site never
         // named as a brand resolves to no brand and scores 0, exactly as it does there.
         const brandByDomain = new Map(rankBrandProfiles(all).filter((b) => b.domain).map((b) => [NORM(b.domain), b.brand]));
         const brandOf = (d: string): string => brandByDomain.get(NORM(d)) || d;
         const wanted = typeof req.query.competitor === 'string' ? NORM(req.query.competitor) : '';
         // Full sources/prompts only for own + top-5 (+ optional compare); rest = overview scores.
         const byDomain = buildSnapshotsForScan(all, own, {
            fullDetailTopCompetitors: 5,
            extraFullDomains: wanted ? [wanted] : [],
         });
         // Every headline number on this page is the BRAND metric, so our gauge, the
         // competitor cards and the trend all read on one scale — and agree with the
         // Competitors tab. The snapshots underneath stay citation-based: that is what
         // Sources, the prompt overlap and the gap are made of.
         const ownSnap = withBrandHeadline(byDomain.get(ownKey) ?? snapshotForDomain(all, own), all, scanBrand);
         const ranked = rankCompetitors(byDomain, own)
            .map((c) => ({ ...c, snapshot: withBrandHeadline(c.snapshot, all, brandOf(c.domain)) }))
            .sort((a, b) => b.snapshot.overview.visibilityScore - a.snapshot.overview.visibilityScore);

         const competitors = ranked.slice(0, 5).map((c) => ({ domain: c.domain, snapshot: withoutSources(c.snapshot) }));
         const competitorsAll = ranked.map((c) => ({ domain: c.domain, visibilityScore: c.snapshot.overview.visibilityScore }));

         // Long-tail: a picker choice outside the top-5. Reuse the already-computed map.
         const compare = wanted && byDomain.has(wanted) && !competitors.some((c) => c.domain === wanted)
            ? {
               competitorDomain: wanted,
               snapshot: withoutSources(withBrandHeadline(byDomain.get(wanted) as DomainSnapshot, all, brandOf(wanted))),
            } : null;

         // "Previous" = the completed scan that finished before this one (chronology
         // by finished_at, NOT id — a retry may have a higher id but earlier finish).
         const prev = scan.finished_at
            ? await getPreviousDisplayScan(domain.ID, scan.finished_at)
            : undefined;
         // The previous snapshot gets the same brand headline, or the delta would compare
         // a brand score against a citation score and invent a jump that never happened.
         const prevRows = prev ? filterRows(await loadScanRows(prev.id)) : null;
         const delta = prevRows && prev
            ? computeDelta(ownSnap, withBrandHeadline(snapshotForDomain(prevRows, own), prevRows, prev.brand_name || ownBrand))
            : null;

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
         // Brand-keyed, like the reference tool: one row per brand the answers name (the
         // tracked brand included), sorted by presence. Domain-keyed ranking still backs the
         // citation-overlap views, where a site really is the unit.
         const promptFilter = parseIds(req.query.prompts);
         const modelFilter = parseList(req.query.models);

         // Unfiltered view reads the profiles the "building brand profiles" phase wrote;
         // any filter has to be scored live, since stored profiles cover the whole scan.
         if (!promptFilter.length && !modelFilter.length) {
            const stored = await queryRows<{ brand: string; domain: string | null; mentions: number; avg_position: number | null; presence_score: number | null }>(
               `SELECT brand, domain, mentions, avg_position, presence_score
                FROM ai_vis_brand_profiles WHERE scan_id = ? ORDER BY presence_score DESC, mentions DESC`,
               [scan.id],
            );
            if (stored.length) {
               const pairsRow = await queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM ai_vis_results WHERE scan_id = ?', [scan.id]);
               const pairs = Math.max(1, Number(pairsRow?.n ?? 0));
               return res.status(200).json({
                  competitors: stored.map((p) => ({
                     brand: p.brand,
                     domain: p.domain || '',
                     mentions: p.mentions,
                     mentionRate: Math.round((p.mentions / pairs) * 100),
                     avgPosition: p.avg_position,
                     visibilityScore: p.presence_score ?? 0,
                  })),
               });
            }
         }

         const all = filterRows(await loadScanResultRows(scan.id));
         return res.status(200).json({ competitors: rankBrandProfiles(all) });
      }
      if (view === 'competitor-detail') {
         const comp = typeof req.query.competitor === 'string' ? req.query.competitor : '';
         if (!comp) return res.status(400).json({ error: 'competitor required' });
         const all = filterRows(await loadScanResultRows(scan.id));
         const snap = snapshotForDomain(all, comp);
         const sources = snap.sources.filter((s) => s.domain === NORM(comp));
         // Prefer the brand name the answers actually use; fall back to the domain's first
         // label (www.squarespace.com → "Squarespace") when this site is never named.
         const named = rankBrandProfiles(all).find((b) => b.domain && NORM(b.domain) === NORM(comp));
         const base = NORM(comp).split('.')[0];
         const brand = named?.brand || (base ? base.charAt(0).toUpperCase() + base.slice(1) : comp);
         const ms = sourceMentions(all, ownBrand, brand);
         return res.status(200).json({
            // Brand metric, so this modal shows the same score as the row that opened it.
            overview: brandOverviewForDomain(all, comp),
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
         // The favicon stack shows the brands the answers put FIRST, capped at five, which
         // is the same slice the reference tool returns per prompt (brand + avg position).
         const brandDomains = (rows2: ResultRow[]): string[] => {
            const posByDomain = new Map<string, { sum: number; n: number }>();
            for (const r of rows2) for (const b of r.brands) {
               if (!b.domain) continue;
               const d = NORM(b.domain);
               const e = posByDomain.get(d) ?? { sum: 0, n: 0 };
               e.sum += b.pos; e.n += 1;
               posByDomain.set(d, e);
            }
            return Array.from(posByDomain.entries())
               .sort((a, b) => (a[1].sum / a[1].n) - (b[1].sum / b[1].n))
               .slice(0, 5)
               .map(([d]) => d);
         };
         const byPrompt = new Map<number, ResultRow[]>();
         for (const r of all) { const l = byPrompt.get(r.promptId) ?? []; l.push(r); byPrompt.set(r.promptId, l); }
         const promptMeta = new Map<number, { topic: string, text: string }>();
         for (const r of all) if (!promptMeta.has(r.promptId)) promptMeta.set(r.promptId, { topic: r.topic, text: r.text });
         const byTopic = new Map<string, ResultRow[]>();
         for (const r of all) { const l = byTopic.get(r.topic) ?? []; l.push(r); byTopic.set(r.topic, l); }

         // Prompt/topic metrics are the tracked BRAND's, from the mentions in each answer —
         // matching the reference tool, whose per-prompt average position is the brand's own
         // entry in that prompt's brand list. Domain citations drive the Sources views.
         const topics = Array.from(byTopic.entries()).map(([topic, topicRows]) => {
            const ov = computeBrandOverview(topicRows, ownBrand);
            const promptIds = Array.from(new Set(topicRows.map((r) => r.promptId)));
            const prompts = promptIds.map((id) => {
               const pr = byPrompt.get(id) || [];
               const pov = computeBrandOverview(pr, ownBrand);
               return { id, text: promptMeta.get(id)?.text || '', visibility: pov.visibilityScore, mentionRate: pov.mentionRate, avgPosition: pov.avgPosition, brands: brandDomains(pr) };
            });
            return { topic, promptCount: prompts.length, visibility: ov.visibilityScore, mentionRate: ov.mentionRate, avgPosition: ov.avgPosition, brands: brandDomains(topicRows), prompts };
         }).sort((a, b) => b.visibility - a.visibility);

         const overall = computeBrandOverview(all, ownBrand);
         return res.status(200).json({
            overview: { visibilityScore: overall.visibilityScore, mentionRate: overall.mentionRate, avgPosition: overall.avgPosition },
            topics,
         });
      }
      if (view === 'prompts') {
         const citationRows = await loadScanRows(scan.id);
         const byPrompt = new Map<number, { id: number, topic: string, text: string, perModel: Array<{ model: string, cited: boolean, position: number | null }> }>();
         for (const r of citationRows) {
            const entry = byPrompt.get(r.promptId) ?? { id: r.promptId, topic: r.topic, text: r.text, perModel: [] };
            entry.perModel.push({ model: r.model, cited: r.ownCited, position: r.ownPosition });
            byPrompt.set(r.promptId, entry);
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

export default withOrgPaymentAccess(handler);
