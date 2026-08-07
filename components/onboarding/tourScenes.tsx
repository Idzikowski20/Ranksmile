/**
 * Illustrations for the post-onboarding page tour (Koala GuidedTour image slot).
 *
 * Anatomy, shared by every scene: a flat accent panel with an app "window" offset into
 * it, bleeding off the right and bottom edges so the frame reads as a crop of a bigger
 * screen. Exactly one thing inside carries the accent — that's what names the page.
 * Anything meaningful stays inside ~80% of the width, clear of that right-edge crop.
 *
 * Themes: the panel keeps its accent in both, while the window flips to
 * `background/inverse` — dark chrome on a light card, light chrome on a dark one.
 * Everything drawn on the window is a `color-mix` of `background/primary` (the card
 * surface), so the contents invert with it and no scene needs a second asset.
 *
 * Motion, two layers, both driven by attributes on the parts that should move:
 *   `data-anim` — the one-shot entrance.
 *   `data-loop` — an ambient loop that keeps running while the step is on screen, so
 *                 the card is still doing something a few seconds in.
 * Entrance tweens are `from`/`fromTo` and loops settle back to the authored values, so
 * the rest state is the final state: if GSAP never runs, the scene is still correct,
 * just static. That is also exactly what a reduced-motion viewer gets.
 */
import React, { useRef } from 'react';
import styled from '@emotion/styled';
import { semantic } from '../koala/tokens/semantic';
import { typeface } from '../koala/tokens/typography';
import {
  DURATION, EASE, gsap, prefersReducedMotion, registerMotionPlugins, useGSAP,
} from '../../lib/motion/gsap';

/** Ink on the window surface — flips with the window because bg-primary does. */
const ink = (pct: number) => `color-mix(in srgb, ${semantic.background.primary} ${pct}%, transparent)`;

/** Ambient loops start once the entrance has settled, so the two never fight. */
const LOOP_DELAY = 0.9;

/* ── Motion ────────────────────────────────────────────────────────────── */

/**
 * Entrance (`data-anim`): `rise` fade up · `sweep` grow from the left · `grow` grow
 * from the baseline · `arc` sweep a gauge to its value · `pop` scale in ·
 * `count` tick a number up to `data-to`.
 *
 * Ambient (`data-loop`): `pulse` breathe · `relay` staggered dim sweeping a list ·
 * `breathe` bars shifting height · `refill` a bar refilling · `drift` slow float ·
 * `blink` status dots firing · `trace` a stroke redrawing itself. Numbers with
 * `data-swing` keep drifting after their count-up.
 *
 * Built synchronously inside `useGSAP` so the hook's context owns every tween and
 * reverts them on unmount (the repo's `sync-create-in-useGSAP` rule).
 */
function useSceneIntro<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useGSAP(() => {
    const root = ref.current;
    if (!root) return;
    registerMotionPlugins();
    // Rest state is already the final state, so bailing here just means "no motion".
    if (prefersReducedMotion()) return;

    const q = (name: string) => gsap.utils.toArray<HTMLElement>(root.querySelectorAll(`[data-anim="${name}"]`));
    const tl = gsap.timeline({ defaults: { ease: EASE.out } });

    const rise = q('rise');
    if (rise.length) tl.from(rise, { opacity: 0, y: 10, duration: DURATION.normal, stagger: 0.05 }, 0.05);

    const sweep = q('sweep');
    if (sweep.length) {
      tl.from(sweep, {
        scaleX: 0, transformOrigin: 'left center', duration: DURATION.slow, stagger: 0.05,
      }, 0.12);
    }

    const grow = q('grow');
    if (grow.length) {
      tl.from(grow, {
        scaleY: 0, transformOrigin: 'bottom center', duration: DURATION.slow, stagger: 0.05,
      }, 0.12);
    }

    // Gauge arcs carry their value in `stroke-dasharray` ("visible gap"). Drawing them
    // with `draw` would overwrite that array and leave every gauge reading 100%, so
    // only the offset moves here — the dash pattern, and the value, stay put.
    q('arc').forEach((el, i) => {
      const visible = parseFloat(el.getAttribute('stroke-dasharray') ?? '');
      if (!Number.isFinite(visible) || visible <= 0) return;
      tl.fromTo(
        el,
        { strokeDashoffset: visible },
        {
          strokeDashoffset: 0, duration: DURATION.slower, ease: EASE.inOut, immediateRender: false,
        },
        0.15 + i * 0.08,
      );
    });

    const pop = q('pop');
    if (pop.length) {
      tl.from(pop, {
        scale: 0.5, opacity: 0, duration: DURATION.normal, stagger: 0.06, transformOrigin: 'center',
      }, 0.28);
    }

    q('count').forEach((el) => {
      const to = Number(el.dataset.to);
      if (!Number.isFinite(to)) return;
      const node = el;
      const fmt = (n: number) => (n >= 1000 ? n.toLocaleString('en-US') : String(n));
      const box = { v: 0 };
      tl.to(box, {
        v: to,
        duration: DURATION.slower,
        onUpdate: () => { node.textContent = fmt(Math.round(box.v)); },
      }, 0.2);

      // `data-swing` keeps the figure alive afterwards, drifting a few units as if the
      // number were still coming in.
      const swing = Number(node.dataset.swing);
      if (!Number.isFinite(swing) || swing === 0) return;
      gsap.to(box, {
        v: to + swing,
        duration: 2.6,
        ease: EASE.inOut,
        repeat: -1,
        yoyo: true,
        delay: LOOP_DELAY,
        onUpdate: () => { node.textContent = fmt(Math.round(box.v)); },
      });
    });

    /* ── Ambient loops ──────────────────────────────────────────────────
       Everything below runs forever while the step is on screen, so the card
       keeps moving after the entrance settles. Only the current step is
       mounted, and useGSAP's scope kills these on unmount. */
    const loop = (name: string) => gsap.utils.toArray<HTMLElement>(root.querySelectorAll(`[data-loop="${name}"]`));

    const pulse = loop('pulse');
    if (pulse.length) {
      gsap.to(pulse, {
        scale: 1.06,
        duration: 1.3,
        ease: EASE.inOut,
        repeat: -1,
        yoyo: true,
        transformOrigin: 'center',
        stagger: 0.2,
        delay: LOOP_DELAY,
      });
    }

    // Staggered dim/undim sweeping down a list — reads as the app working the rows.
    const relay = loop('relay');
    if (relay.length) {
      gsap.to(relay, {
        opacity: 0.4,
        duration: 0.7,
        ease: EASE.inOut,
        repeat: -1,
        yoyo: true,
        stagger: 0.22,
        delay: LOOP_DELAY,
      });
    }

    const breathe = loop('breathe');
    if (breathe.length) {
      gsap.to(breathe, {
        scaleY: 0.72,
        duration: 1.6,
        ease: EASE.inOut,
        repeat: -1,
        yoyo: true,
        transformOrigin: 'bottom center',
        stagger: { each: 0.18, from: 'random' },
        delay: LOOP_DELAY,
      });
    }

    const refill = loop('refill');
    if (refill.length) {
      gsap.fromTo(refill, { scaleX: 0 }, {
        scaleX: 1,
        duration: 1.6,
        ease: EASE.inOut,
        repeat: -1,
        repeatDelay: 1.6,
        transformOrigin: 'left center',
        stagger: 0.15,
        delay: LOOP_DELAY,
      });
    }

    const drift = loop('drift');
    if (drift.length) {
      gsap.to(drift, {
        y: -4,
        duration: 2.2,
        ease: EASE.inOut,
        repeat: -1,
        yoyo: true,
        stagger: { each: 0.3, from: 'random' },
        delay: LOOP_DELAY,
      });
    }

    const blink = loop('blink');
    if (blink.length) {
      gsap.to(blink, {
        opacity: 0.25,
        duration: 0.6,
        ease: EASE.inOut,
        repeat: -1,
        yoyo: true,
        stagger: 0.18,
        delay: LOOP_DELAY,
      });
    }

    // Re-traces a stroke on a loop: the chart or branch redrawing itself.
    loop('trace').forEach((el, i) => {
      const len = (el as unknown as SVGPathElement).getTotalLength?.();
      if (!len) return;
      gsap.fromTo(el, { strokeDashoffset: len }, {
        strokeDasharray: len,
        strokeDashoffset: 0,
        duration: 1.9,
        ease: EASE.inOut,
        repeat: -1,
        repeatDelay: 1.7,
        delay: LOOP_DELAY + i * 0.12,
      });
    });
  }, { scope: ref });
  return ref;
}

/* ── Primitives ────────────────────────────────────────────────────────── */

const Panel = styled.div<{ $accent: string }>`
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: ${(p) => p.$accent};
`;

/** Offset + oversized so it crops on the right/bottom instead of sitting centered. */
const Window = styled.div`
  position: absolute;
  top: 22px;
  left: 22px;
  right: -36px;
  bottom: -28px;
  border-radius: 10px;
  background: ${semantic.background.inverse};
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: hidden;
`;

export type TourSceneProps = { accent: string };

/** Panel + window + the GSAP intro, so a scene is just its contents. */
function Scene({ accent, children, gap }: TourSceneProps & { children: React.ReactNode; gap?: number }) {
  const ref = useSceneIntro<HTMLDivElement>();
  return (
    <Panel $accent={accent}>
      <Window ref={ref} style={gap != null ? { gap } : undefined}>{children}</Window>
    </Panel>
  );
}

const Row = styled.div<{ $w: string; $h?: number }>`
  width: ${(p) => p.$w};
  height: ${(p) => p.$h ?? 10}px;
  border-radius: 999px;
  background: ${ink(12)};
  flex-shrink: 0;
`;

const Tile = styled.div`
  flex: 1;
  min-width: 0;
  border-radius: 8px;
  background: ${ink(9)};
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

/** Carries the accent fill. Motion comes from `data-anim`, not CSS. */
const Highlight = styled.div<{ $accent: string }>`
  background: ${(p) => p.$accent};
`;

const HighlightTile = Highlight.withComponent(Tile);

/** Leading marker in a list row — dot, square or chip depending on the page. */
const Mark = styled.div<{ $size?: number; $round?: string }>`
  width: ${(p) => p.$size ?? 8}px;
  height: ${(p) => p.$size ?? 8}px;
  border-radius: ${(p) => p.$round ?? '999px'};
  background: ${ink(16)};
  flex-shrink: 0;
`;

const HighlightMark = Highlight.withComponent(Mark);

/** Row sitting on an accent band — inverted so it reads against the fill. */
const OnAccent = styled.div<{ $w: string; $h?: number }>`
  width: ${(p) => p.$w};
  height: ${(p) => p.$h ?? 7}px;
  border-radius: 999px;
  background: ${semantic.background.inverse};
  opacity: 0.55;
  flex-shrink: 0;
`;

/**
 * Real text, for the parts where a grey bar carries no meaning — a position, a volume
 * or a column name has to be legible to say anything at all.
 */
const Num = styled.span<{ $strong?: boolean; $size?: number }>`
  font-family: ${typeface.body};
  font-size: ${(p) => p.$size ?? 10}px;
  font-weight: ${(p) => (p.$strong ? 700 : 500)};
  line-height: 1;
  letter-spacing: -0.2px;
  font-variant-numeric: tabular-nums;
  color: ${(p) => ink(p.$strong ? 82 : 52)};
  flex-shrink: 0;
  white-space: nowrap;
`;

/** A table row that stops short of the window's right crop. */
const TableRow = styled.div<{ $ruled?: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 78%;
  padding-bottom: 7px;
  ${(p) => (p.$ruled ? `border-bottom: 1px solid ${ink(9)};` : '')}
`;

/** Spreads the rest of its props so `data-anim` / `data-loop` reach the DOM — a plain
 *  `{ children }` signature silently swallowed them and left scenes unanimated. */
const ListRow = ({ children, ...rest }: React.HTMLAttributes<HTMLDivElement>) => (
  <div {...rest} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '80%' }}>{children}</div>
);

/** Highlighted list row. Width matches ListRow so a trailing label lines up with the
 *  rows below it instead of running past the window's right-edge crop. */
const bandStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 10px',
  borderRadius: 8,
  width: '80%',
  boxSizing: 'border-box',
};

/* ── Icons ─────────────────────────────────────────────────────────────── */

/** 12px stroke glyphs, sized and coloured by the caller. Phosphor-ish weight. */
const Glyph = ({ d, color, size = 12, fill }: { d: string; color: string; size?: number; fill?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" style={{ flexShrink: 0 }} aria-hidden>
    <path
      d={d}
      fill={fill ? color : 'none'}
      stroke={fill ? 'none' : color}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ICON = {
  cursor: 'M3 2 L12.5 7.2 L8.4 8.4 L6.8 12.6 Z',
  doc: 'M4 2 H9.5 L12 4.6 V14 H4 Z M9.3 2.2 V4.8 H12',
  bulb: 'M6 12.5 H10 M6.6 14.2 H9.4 M8 1.8 A4.2 4.2 0 0 1 10.5 9.4 V10.8 H5.5 V9.4 A4.2 4.2 0 0 1 8 1.8 Z',
  pen: 'M11.4 2.2 L13.8 4.6 L5.6 12.8 L2.4 13.6 L3.2 10.4 Z',
  warn: 'M8 2.4 L14.6 13.4 H1.4 Z M8 6.4 V9.4 M8 11.2 V11.4',
  check: 'M3.2 8.4 L6.4 11.4 L12.8 4.8',
  clock: 'M8 2.4 A5.6 5.6 0 1 1 7.99 2.4 M8 4.8 V8 L10.2 9.6',
  refresh: 'M13.2 6.6 A5.4 5.4 0 1 0 13.4 9.4 M13.2 3 V6.8 H9.4',
  glass: 'M7 2.6 A4.4 4.4 0 1 1 6.99 2.6 M10.4 10.4 L13.8 13.8',
  spark: 'M8 1.2 L9.7 6.3 L14.8 8 L9.7 9.7 L8 14.8 L6.3 9.7 L1.2 8 L6.3 6.3 Z',
  branch: 'M3.4 8 H7 M7 8 V3.4 H12.6 M7 8 V12.6 H12.6',
} as const;

/** Up/down caret. */
const Tri = ({ up, color }: { up: boolean; color: string }) => (
  <svg width={8} height={8} viewBox="0 0 9 9" style={{ flexShrink: 0 }} aria-hidden>
    <path d={up ? 'M4.5 0.8 L8.2 7.2 H0.8 Z' : 'M4.5 7.2 L0.8 0.8 H8.2 Z'} fill={color} />
  </svg>
);

/** The 240° horseshoe the Site Audit health gauge uses: r=20 around (28,28). */
const ARC_PATH = 'M 10.7 38 A 20 20 0 1 1 45.3 38';
const ARC_LEN = 2 * Math.PI * 20 * (240 / 360);

function Horseshoe({ accent, pct, size = 54 }: { accent: string; pct: number; size?: number }) {
  return (
    <svg width={size} height={size * 0.82} viewBox="0 0 56 46" style={{ flexShrink: 0 }} aria-hidden>
      <path d={ARC_PATH} fill="none" stroke={ink(14)} strokeWidth={6} strokeLinecap="round" />
      <path
        d={ARC_PATH}
        fill="none"
        stroke={accent}
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={`${ARC_LEN * pct} ${ARC_LEN}`}
        data-anim="arc"
      />
    </svg>
  );
}

/* ── Workspace ─────────────────────────────────────────────────────────── */

/** Dashboard — the three headline stats the page opens with, one pulled forward. */
export function DashboardScene({ accent }: TourSceneProps) {
  const stats = [
    { icon: ICON.cursor, label: 'Clicks', to: 1596, hot: false },
    { icon: ICON.doc, label: 'Articles', to: 24, hot: true },
    { icon: ICON.bulb, label: 'Actions', to: 8, hot: false },
  ];
  return (
    <Scene accent={accent} gap={10}>
      <Num data-anim="rise">Last 30 days</Num>
      <div style={{ display: 'flex', gap: 8, width: '82%' }}>
        {stats.map((s) => {
          const body = (
            <>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Glyph d={s.icon} color={s.hot ? semantic.background.inverse : ink(40)} size={11} />
                <Num style={s.hot ? { color: semantic.background.inverse, opacity: 0.7 } : undefined}>{s.label}</Num>
              </span>
              <Num
                $strong
                $size={15}
                data-anim="count"
                data-to={s.to}
                data-swing={s.hot ? 0 : 8}
                style={s.hot ? { color: semantic.background.inverse } : undefined}
              >
                {s.to.toLocaleString('en-US')}
              </Num>
            </>
          );
          return s.hot
            ? <HighlightTile key={s.label} $accent={accent} data-anim="rise" data-loop="pulse">{body}</HighlightTile>
            : <Tile key={s.label} data-anim="rise">{body}</Tile>;
        })}
      </div>
      <Num data-anim="rise">Recommendations</Num>
      {['82%', '60%'].map((w) => (
        <ListRow key={w} data-loop="relay">
          <Mark $size={10} $round="3px" />
          <Row $w={w} $h={7} data-anim="sweep" />
        </ListRow>
      ))}
    </Scene>
  );
}

/** Content — a draft in the editor with its live score, one line being rewritten. */
export function ContentScene({ accent }: TourSceneProps) {
  return (
    <Scene accent={accent} gap={8}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '80%' }} data-anim="rise">
        <Glyph d={ICON.pen} color={ink(40)} size={12} />
        <Row $w="42%" $h={11} />
        <div style={{ flex: 1 }} />
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 7px', borderRadius: 999, background: ink(10),
        }}
        >
          <Num $strong data-anim="count" data-to={78} data-swing={4} style={{ color: accent }}>78</Num>
          <Num>score</Num>
        </span>
      </div>
      <span style={{ height: 1, background: ink(10), width: '80%', flexShrink: 0, margin: '2px 0' }} />
      <Row $w="88%" $h={7} data-anim="sweep" />
      <Row $w="80%" $h={7} data-anim="sweep" />
      <Highlight $accent={accent} style={{ height: 9, width: '66%', borderRadius: 999 }} data-anim="sweep" data-loop="refill" />
      <Row $w="84%" $h={7} data-anim="sweep" />
      <Row $w="52%" $h={7} data-anim="sweep" />
    </Scene>
  );
}

/* ── SEO ───────────────────────────────────────────────────────────────── */

/** Performance — the clicks total and its Search Console curve. */
export function PerformanceScene({ accent }: TourSceneProps) {
  const LINE = 'M0 52 L28 44 L56 50 L84 28 L112 34 L140 16 L168 24 L200 8';
  return (
    <Scene accent={accent} gap={8}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }} data-anim="rise">
        <Num $strong $size={16} data-anim="count" data-to={1596} data-swing={11}>1,596</Num>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          <Tri up color={accent} />
          <Num style={{ color: accent }}>12%</Num>
        </span>
      </div>
      <Num data-anim="rise">Clicks · last 30 days</Num>
      <svg
        viewBox="0 0 200 70"
        preserveAspectRatio="none"
        style={{ width: '86%', flex: 1, minHeight: 0 }}
        aria-hidden
      >
        {[0, 1, 2, 3].map((i) => (
          <line key={i} x1={0} x2={200} y1={12 + i * 16} y2={12 + i * 16} stroke={ink(9)} strokeWidth={1} />
        ))}
        <path d={`${LINE} V70 H0 Z`} fill={accent} opacity={0.2} />
        <path
          d={LINE}
          fill="none"
          stroke={accent}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          data-loop="trace"
        />
      </svg>
      <div style={{ display: 'flex', gap: 22 }} data-anim="rise">
        <Num>1 Jul</Num>
        <Num>15 Jul</Num>
        <Num>30 Jul</Num>
      </div>
    </Scene>
  );
}

/** Site Audit — the two health cards the report opens with, over the issue list. */
export function SiteAuditScene({ accent }: TourSceneProps) {
  const issues = [
    { icon: ICON.warn, w: '52%', n: '12' },
    { icon: ICON.warn, w: '44%', n: '7' },
    { icon: ICON.check, w: '48%', n: '3' },
  ];
  return (
    <Scene accent={accent} gap={9}>
      <div style={{ display: 'flex', gap: 8, width: '78%' }}>
        {[{ label: 'Site Health', pct: 0.78, v: 78 }, { label: 'AI Search', pct: 0.54, v: 54 }].map((g) => (
          <Tile key={g.label} style={{ gap: 2, alignItems: 'center' }} data-anim="rise">
            <Num>{g.label}</Num>
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              <Horseshoe accent={accent} pct={g.pct} />
              <span style={{
                position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', paddingTop: 4,
              }}
              >
                <Num $strong $size={13} data-anim="count" data-to={g.v}>{g.v}</Num>
              </span>
            </span>
          </Tile>
        ))}
      </div>
      {issues.map((it) => (
        <ListRow key={it.n} data-loop="relay">
          <Glyph d={it.icon} color={ink(34)} size={11} />
          <Row $w={it.w} $h={7} data-anim="sweep" />
          <div style={{ flex: 1 }} />
          <Num>{it.n}</Num>
        </ListRow>
      ))}
    </Scene>
  );
}

/** Recommendations — the search drop that produced the queue, over the actions. */
export function RecommendationsScene({ accent }: TourSceneProps) {
  return (
    <Scene accent={accent} gap={8}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} data-anim="rise">
        <span style={{ position: 'relative', display: 'inline-flex' }}>
          <Horseshoe accent={accent} pct={0.34} size={46} />
          <span style={{
            position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', paddingTop: 3,
          }}
          >
            <Num $strong $size={12} data-anim="count" data-to={34}>34</Num>
          </span>
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <Num>Site Health</Num>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Tri up={false} color={accent} />
            <Num $strong style={{ color: accent }}>18 pts</Num>
          </span>
        </div>
      </div>
      <Highlight $accent={accent} style={bandStyle} data-anim="rise" data-loop="pulse">
        <Glyph d={ICON.check} color={semantic.background.inverse} size={12} />
        <OnAccent $w="52%" />
        <div style={{ flex: 1 }} />
        <Num style={{ color: semantic.background.inverse, opacity: 0.75 }}>High</Num>
      </Highlight>
      {[{ w: '58%', p: 'Med' }, { w: '48%', p: 'Low' }].map((r) => (
        <ListRow key={r.p}>
          <Mark $size={12} $round="4px" />
          <Row $w={r.w} $h={7} data-anim="sweep" />
          <div style={{ flex: 1 }} />
          <Num>{r.p}</Num>
        </ListRow>
      ))}
    </Scene>
  );
}

/** Content Audit — published pages as scored cards, the one to refresh in accent. */
export function ContentAuditScene({ accent }: TourSceneProps) {
  const cards = [
    { w: '66%', score: 82, pct: '82%', hot: false },
    { w: '52%', score: 31, pct: '31%', hot: true },
    { w: '70%', score: 88, pct: '88%', hot: false },
    { w: '58%', score: 64, pct: '64%', hot: false },
  ];
  return (
    <Scene accent={accent} gap={10}>
      <Num data-anim="rise">Published pages</Num>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '70%' }}>
        {cards.map((c) => {
          const on = c.hot;
          const body = (
            <>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                {on ? <Glyph d={ICON.refresh} color={semantic.background.inverse} size={11} /> : null}
                <Row
                  $w={c.w}
                  $h={6}
                  style={on ? { background: semantic.background.inverse, opacity: 0.5 } : undefined}
                />
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Num
                  $strong
                  data-anim="count"
                  data-to={c.score}
                  style={on ? { color: semantic.background.inverse } : undefined}
                >
                  {c.score}
                </Num>
                <span style={{
                  flex: 1, height: 5, borderRadius: 999, background: on ? ink(24) : ink(13), overflow: 'hidden',
                }}
                >
                  <span
                    data-anim="sweep"
                    style={{
                      display: 'block',
                      width: c.pct,
                      height: '100%',
                      borderRadius: 999,
                      background: on ? semantic.background.inverse : ink(30),
                    }}
                    data-loop="refill"
                  />
                </span>
              </span>
            </>
          );
          return on
            ? <HighlightTile key={c.score} $accent={accent} style={{ gap: 7 }} data-anim="rise">{body}</HighlightTile>
            : <Tile key={c.score} style={{ gap: 7 }} data-anim="rise">{body}</Tile>;
        })}
      </div>
    </Scene>
  );
}

/** Keyword list — the organic table read as volume per keyword, plus its direction. */
export function KeywordListScene({ accent }: TourSceneProps) {
  const rows = [
    { kw: '54%', vol: '2.4K', bar: 46, up: true, hot: true },
    { kw: '40%', vol: '880', bar: 30, up: true, hot: false },
    { kw: '62%', vol: '540', bar: 22, up: false, hot: false },
    { kw: '46%', vol: '210', bar: 14, up: false, hot: false },
  ];
  return (
    <Scene accent={accent} gap={7}>
      <TableRow data-anim="rise">
        <Row $w="26%" $h={5} style={{ opacity: 0.55 }} />
        <div style={{ flex: 1 }} />
        <Num>Volume</Num>
        <span style={{ width: 8 }} />
      </TableRow>
      {rows.map((r) => (
        <TableRow key={r.vol} data-anim="rise" data-loop="relay">
          <Row $w={r.kw} $h={7} />
          <div style={{ flex: 1 }} />
          <span style={{
            position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end',
          }}
          >
            <span
              style={{
                position: 'absolute',
                right: -3,
                height: 13,
                width: r.bar,
                borderRadius: 4,
                background: r.hot ? accent : ink(10),
                opacity: r.hot ? 0.35 : 1,
              }}
            />
            <Num $strong={r.hot} style={{ position: 'relative' }}>{r.vol}</Num>
          </span>
          <Tri up={r.up} color={r.hot ? accent : ink(r.up ? 32 : 20)} />
        </TableRow>
      ))}
    </Scene>
  );
}

/** Keyword tracking — where each keyword sits today and how many places it moved. */
export function KeywordTrackingScene({ accent }: TourSceneProps) {
  const rows = [
    { kw: '52%', pos: '3', delta: '4', up: true, hot: true },
    { kw: '38%', pos: '7', delta: '1', up: true, hot: false },
    { kw: '60%', pos: '12', delta: '3', up: false, hot: false },
    { kw: '44%', pos: '18', delta: '2', up: false, hot: false },
  ];
  return (
    <Scene accent={accent} gap={7}>
      <TableRow $ruled data-anim="rise">
        <Row $w="24%" $h={5} style={{ opacity: 0.55 }} />
        <div style={{ flex: 1 }} />
        <Num style={{ width: 20, textAlign: 'right' }}>Pos</Num>
        <Num style={{ width: 26, textAlign: 'right' }}>Chg</Num>
      </TableRow>
      {rows.map((r, i) => (
        <TableRow key={r.pos} $ruled={i < rows.length - 1} data-anim="rise" data-loop="relay">
          <Row $w={r.kw} $h={7} />
          <div style={{ flex: 1 }} />
          <Num $strong={r.hot} style={{ width: 20, textAlign: 'right' }}>{r.pos}</Num>
          <span style={{
            width: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3,
          }}
          >
            <Tri up={r.up} color={r.hot ? accent : ink(r.up ? 32 : 20)} />
            <Num $strong={r.hot} style={{ color: r.hot ? accent : undefined }}>{r.delta}</Num>
          </span>
        </TableRow>
      ))}
    </Scene>
  );
}

/** Activity Log — the run history rail: what ran, when, and how it finished. */
export function ActivityLogScene({ accent }: TourSceneProps) {
  const runs = [
    { w: '52%', when: '2m', ok: true, hot: true },
    { w: '62%', when: '1h', ok: true, hot: false },
    { w: '46%', when: '3h', ok: false, hot: false },
    { w: '58%', when: '1d', ok: true, hot: false },
  ];
  return (
    <Scene accent={accent} gap={0}>
      <Num data-anim="rise">Recent runs</Num>
      <div style={{ position: 'relative', marginTop: 12, paddingLeft: 18, width: '84%' }}>
        <span style={{
          position: 'absolute', left: 5, top: 5, bottom: 12, width: 2, background: ink(12), borderRadius: 999,
        }}
        />
        {runs.map((r) => (
          <div
            key={r.when}
            data-anim="rise"
            data-loop="relay"
            style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 13, position: 'relative',
            }}
          >
            <span style={{ position: 'absolute', left: -18, display: 'inline-flex' }}>
              {r.hot
                ? <HighlightMark $accent={accent} $size={12} data-anim="pop" data-loop="pulse" />
                : <Mark $size={12} />}
            </span>
            <Glyph d={r.ok ? ICON.check : ICON.warn} color={r.hot ? accent : ink(30)} size={11} />
            <Row $w={r.w} $h={7} />
            <div style={{ flex: 1 }} />
            <Num>{r.when}</Num>
          </div>
        ))}
      </div>
    </Scene>
  );
}

/** Automations — the publishing calendar, one scheduled slot in accent. */
export function AutomationsScene({ accent }: TourSceneProps) {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return (
    <Scene accent={accent} gap={8}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} data-anim="rise">
        <Glyph d={ICON.clock} color={ink(40)} size={11} />
        <Num>Scheduled · 3 this week</Num>
      </div>
      <div style={{ width: '72%', display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5 }} data-anim="rise">
          {days.map((d, i) => (
            <Num key={`${d}${i}`} style={{ textAlign: 'center', opacity: 0.7 }}>{d}</Num>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5 }}>
          {Array.from({ length: 21 }, (_, i) => i).map((i) => {
            const weekend = i % 7 >= 5;
            if (i === 9) {
              return (
                <Highlight
                  key={i}
                  $accent={accent}
                  data-anim="pop"
                  data-loop="pulse"
                  style={{
                    aspectRatio: '1', borderRadius: 4, display: 'grid', placeItems: 'center',
                  }}
                >
                  <Glyph d={ICON.doc} color={semantic.background.inverse} size={9} />
                </Highlight>
              );
            }
            return (
              <div
                key={i}
                data-anim="rise"
                style={{ aspectRatio: '1', borderRadius: 4, background: ink(weekend ? 6 : 11) }}
              />
            );
          })}
        </div>
      </div>
    </Scene>
  );
}

/* ── AI Visibility ─────────────────────────────────────────────────────── */

/** Overview — the visibility score, its trend, and the sources feeding it. */
export function AiOverviewScene({ accent }: TourSceneProps) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const TREND = 'M0 20 L18 17 L36 21 L54 11 L72 14 L100 4';
  return (
    <Scene accent={accent} gap={9}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '80%' }} data-anim="rise">
        <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
          <svg width={54} height={54} viewBox="0 0 54 54" aria-hidden>
            <circle cx={27} cy={27} r={r} fill="none" stroke={ink(12)} strokeWidth={7} />
            <circle
              cx={27}
              cy={27}
              r={r}
              fill="none"
              stroke={accent}
              strokeWidth={7}
              strokeLinecap="round"
              strokeDasharray={`${c * 0.62} ${c}`}
              transform="rotate(-90 27 27)"
              data-anim="arc"
            />
          </svg>
          <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
            <Num $strong $size={13} data-anim="count" data-to={62} data-swing={5}>62</Num>
          </span>
        </span>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <Num>Visibility score</Num>
          <svg viewBox="0 0 100 26" preserveAspectRatio="none" style={{ width: '100%', height: 26 }} aria-hidden>
            <path d={`${TREND} V26 H0 Z`} fill={accent} opacity={0.18} />
            <path
              d={TREND}
              fill="none"
              stroke={accent}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              data-loop="trace"
            />
          </svg>
        </div>
      </div>
      <span style={{ height: 1, background: ink(10), width: '80%', flexShrink: 0 }} />
      {['62%', '48%', '54%'].map((w, i) => (
        <ListRow key={w} data-loop="relay">
          <Glyph d={ICON.spark} color={ink(28)} size={10} fill />
          <Row $w={w} $h={7} data-anim="sweep" />
          <div style={{ flex: 1 }} />
          <Num>{['41', '28', '19'][i]}</Num>
        </ListRow>
      ))}
    </Scene>
  );
}

/** Sources — the search page: a query, the AI overview, and the citation credited. */
export function AiSourcesScene({ accent }: TourSceneProps) {
  return (
    <Scene accent={accent} gap={10}>
      <div
        data-anim="rise"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px',
          borderRadius: 999,
          border: `1px solid ${ink(16)}`,
          width: '78%',
        }}
      >
        <Glyph d={ICON.glass} color={ink(34)} size={11} />
        <Row $w="56%" $h={6} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} data-anim="rise">
        <Glyph d={ICON.spark} color={accent} size={10} fill />
        <Num>AI overview</Num>
      </div>
      <Row $w="74%" $h={7} data-anim="sweep" />
      <Row $w="66%" $h={7} data-anim="sweep" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '78%' }}>
        <Row $w="34%" $h={7} data-anim="sweep" />
        <Highlight
          $accent={accent}
          data-anim="pop"
          data-loop="pulse"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 7px 3px 4px',
            borderRadius: 999,
          }}
        >
          <Mark $size={9} style={{ background: semantic.background.inverse }} />
          <OnAccent $w="22px" $h={5} />
        </Highlight>
      </div>
    </Scene>
  );
}

/** Competitors — the grouped chart from the page: You in accent against each rival. */
export function AiCompetitorsScene({ accent }: TourSceneProps) {
  const groups: Array<[number, number]> = [[0.82, 0.54], [0.82, 0.72], [0.82, 0.38], [0.82, 0.6]];
  const bar = (h: number, fill: string) => (
    <div
      data-anim="grow"
      data-loop="breathe"
      style={{
        width: 13, height: `${h * 100}%`, borderRadius: '4px 4px 0 0', background: fill,
      }}
    />
  );
  return (
    <Scene accent={accent} gap={10}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} data-anim="rise">
        <Num>Share of voice</Num>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Mark $size={7} style={{ background: accent }} />
          <Num>You</Num>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Mark $size={7} />
          <Num>Rival</Num>
        </span>
      </div>
      <div style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        alignItems: 'flex-end',
        gap: 18,
        width: '76%',
        borderBottom: `1px solid ${ink(12)}`,
        paddingBottom: 2,
      }}
      >
        {groups.map(([you, them], i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: '100%' }}>
            {bar(you, accent)}
            {bar(them, ink(18))}
          </div>
        ))}
      </div>
    </Scene>
  );
}

/** Prompts — the tracked questions, in the same box Sources answers. */
export function AiPromptsScene({ accent }: TourSceneProps) {
  const box: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    padding: '7px 10px',
    borderRadius: 999,
    flex: 1,
    minWidth: 0,
  };
  const rows = [
    { w: '58%', hot: true },
    { w: '44%', hot: false },
    { w: '64%', hot: false },
  ];
  return (
    <Scene accent={accent} gap={9}>
      <Num data-anim="rise">Tracked prompts</Num>
      {rows.map((r) => (
        <div key={r.w} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '80%' }} data-anim="rise">
          {r.hot ? (
            <Highlight $accent={accent} style={box} data-loop="pulse">
              <Glyph d={ICON.glass} color={semantic.background.inverse} size={11} />
              <OnAccent $w={r.w} $h={6} />
            </Highlight>
          ) : (
            <div style={{ ...box, border: `1px solid ${ink(16)}` }}>
              <Glyph d={ICON.glass} color={ink(30)} size={11} />
              <Row $w={r.w} $h={6} />
            </div>
          )}
          <span style={{ display: 'inline-flex', gap: 3, flexShrink: 0 }}>
            {[0, 1, 2].map((d) => (
              <Mark key={d} $size={6} data-loop="blink" style={r.hot && d === 0 ? { background: accent } : undefined} />
            ))}
          </span>
        </div>
      ))}
    </Scene>
  );
}

/** Fanout Queries — one prompt branching into the sub-questions engines really ask. */
export function FanoutScene({ accent }: TourSceneProps) {
  const subs = [{ w: '58%', n: '12' }, { w: '48%', n: '9' }, { w: '64%', n: '6' }];
  return (
    <Scene accent={accent} gap={9}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} data-anim="rise">
        <Glyph d={ICON.branch} color={ink(40)} size={11} />
        <Num>1 prompt · 3 fanouts</Num>
      </div>
      <Highlight
        $accent={accent}
        data-anim="rise"
        style={{ ...bandStyle, width: '58%', borderRadius: 999 }}
      >
        <Glyph d={ICON.spark} color={semantic.background.inverse} size={10} fill />
        <OnAccent $w="62%" $h={6} />
      </Highlight>
      <div style={{ position: 'relative', paddingLeft: 22, width: '80%' }}>
        <svg
          width={22}
          height={78}
          viewBox="0 0 22 78"
          style={{ position: 'absolute', left: 2, top: -6 }}
          aria-hidden
        >
          <path
            d="M2 2 V39 M2 12 H20 M2 39 H20 M2 66 H20 M2 39 V66"
            fill="none"
            stroke={ink(14)}
            strokeWidth={1.6}
            strokeLinecap="round"
            data-loop="trace"
          />
        </svg>
        {subs.map((s) => (
          <div
            key={s.n}
            data-anim="rise"
            data-loop="relay"
            style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9,
            }}
          >
            <Row $w={s.w} $h={7} />
            <div style={{ flex: 1 }} />
            <Num>{s.n}</Num>
          </div>
        ))}
      </div>
    </Scene>
  );
}

/* ── Tools ─────────────────────────────────────────────────────────────── */

/** Keyword Research — a seed query and the terms it pulls back, with volumes. */
export function KeywordResearchScene({ accent }: TourSceneProps) {
  const results = [
    { w: '52%', vol: '4.1K' },
    { w: '40%', vol: '1.8K' },
    { w: '58%', vol: '920' },
    { w: '46%', vol: '410' },
  ];
  return (
    <Scene accent={accent} gap={9}>
      <Highlight
        $accent={accent}
        data-anim="rise"
        data-loop="pulse"
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderRadius: 8, width: '78%',
        }}
      >
        <Glyph d={ICON.glass} color={semantic.background.inverse} size={12} />
        <OnAccent $w="46%" $h={6} />
        <div style={{ flex: 1 }} />
        <Num style={{ color: semantic.background.inverse, opacity: 0.75 }}>seed</Num>
      </Highlight>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '78%' }} data-anim="rise">
        <Num>Related terms</Num>
        <div style={{ flex: 1 }} />
        <Num>Volume</Num>
      </div>
      {results.map((r) => (
        <div key={r.vol} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '78%' }} data-anim="rise" data-loop="relay">
          <Row $w={r.w} $h={7} />
          <div style={{ flex: 1 }} />
          <Num>{r.vol}</Num>
        </div>
      ))}
    </Scene>
  );
}

/** Topic Research — a pillar with the cluster of supporting articles around it. */
export function TopicResearchScene({ accent }: TourSceneProps) {
  const satellites = [
    { cx: 26, cy: 20, r: 10 },
    { cx: 122, cy: 16, r: 8 },
    { cx: 22, cy: 72, r: 8 },
    { cx: 126, cy: 74, r: 11 },
    { cx: 74, cy: 88, r: 7 },
  ];
  return (
    <Scene accent={accent} gap={6}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} data-anim="rise">
        <Glyph d={ICON.branch} color={ink(40)} size={11} />
        <Num>Pillar · 5 supporting</Num>
      </div>
      <svg viewBox="0 0 156 104" style={{ width: '82%', flex: 1, minHeight: 0 }} aria-hidden>
        {satellites.map((s) => (
          <line
            key={`l${s.cx}`}
            x1={74}
            y1={48}
            x2={s.cx}
            y2={s.cy}
            stroke={ink(12)}
            strokeWidth={1.5}
            data-loop="trace"
          />
        ))}
        {satellites.map((s) => (
          <circle key={`c${s.cx}`} cx={s.cx} cy={s.cy} r={s.r} fill={ink(14)} data-anim="pop" data-loop="drift" />
        ))}
        <circle cx={74} cy={48} r={19} fill={accent} data-anim="pop" data-loop="pulse" />
      </svg>
    </Scene>
  );
}
