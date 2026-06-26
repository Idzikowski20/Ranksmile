import React from 'react';
import SectionHeader from './SectionHeader';
import Skeleton from './Skeleton';

const font = 'var(--font-family-primary)';

const PerfIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path d="M17 9L11.5657 14.4343C11.3677 14.6323 11.2687 14.7313 11.1545 14.7684C11.0541 14.8011 10.9459 14.8011 10.8455 14.7684C10.7313 14.7313 10.6323 14.6323 10.4343 14.4343L8.56569 12.5657C8.36768 12.3677 8.26867 12.2687 8.15451 12.2316C8.05409 12.1989 7.94591 12.1989 7.84549 12.2316C7.73133 12.2687 7.63232 12.3677 7.43431 12.5657L3 17M17 9H13M17 9V13M7.8 21H16.2C17.8802 21 18.7202 21 19.362 20.673C19.9265 20.3854 20.3854 19.9265 20.673 19.362C21 18.7202 21 17.8802 21 16.2V7.8C21 6.11984 21 5.27976 20.673 4.63803C20.3854 4.07354 19.9265 3.6146 19.362 3.32698C18.7202 3 17.8802 3 16.2 3H7.8C6.11984 3 5.27976 3 4.63803 3.32698C4.07354 3.6146 3.6146 4.07354 3.32698 4.63803C3 5.27976 3 6.11984 3 7.8V16.2C3 17.8802 3 18.7202 3.32698 19.362C3.6146 19.9265 4.07354 20.3854 4.63803 20.673C5.27976 21 6.11984 21 7.8 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ─── Live clicks sparkline ────────────────────────────────────────────────────

const Sparkline = ({ points }: { points: number[] }) => {
  const W = 400;
  const H = 130;
  const baseline = 106;
  const top = 5;
  const n = points.length;
  const max = Math.max(1, ...points);
  const xAt = (i: number) => (n <= 1 ? W : 5 + ((W - 11) * i) / (n - 1));
  const yAt = (v: number) => baseline - (baseline - top) * (v / max);

  let line = '';
  if (n === 0) {
    line = `M5,${baseline}L${W},${baseline}`;
  } else if (n === 1) {
    line = `M5,${yAt(points[0])}L${W},${yAt(points[0])}`;
  } else {
    line = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(' ');
  }
  const area = `${line}L${W},${baseline}L5,${baseline}Z`;

  return (
    <svg height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block', width: '100%' }}>
      <defs>
        <linearGradient id="clicksGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--gray-10)" stopOpacity="1" />
          <stop offset="100%" stopColor="var(--gray-10)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="5" x2={W} y1={baseline} y2={baseline} stroke="var(--gray-20)" strokeWidth="1" />
      <path fill="url(#clicksGradient)" d={area} />
      <path fill="none" stroke="var(--gray-60)" strokeWidth="1" d={line} />
    </svg>
  );
};

// ─── Clicks card (live) ───────────────────────────────────────────────────────

const ClicksCard = ({ total, deltaPct, points, startLabel, endLabel, href }: {
  total: number; deltaPct: number; points: number[]; startLabel: string; endLabel: string; href: string;
}) => {
  const up = deltaPct >= 0;
  return (
    <div style={{ border: '1px solid #E4E4E7', background: 'transparent', padding: 16, minWidth: 0, flex: 1, borderRadius: 12 }}>
      <a href={href} style={{ display: 'flex', flexDirection: 'column', width: '100%', minHeight: 188, color: '#18181B', textDecoration: 'none' }}>
        <div style={{ display: 'flex', flexDirection: 'column', padding: '8px 8px 0' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#9F9FA9', fontFamily: font }}>Clicks</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <div style={{ fontSize: 20, fontWeight: 600, fontFamily: font, fontVariantNumeric: 'tabular-nums slashed-zero' }}>{total}</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', padding: '0 4px', borderRadius: 4, background: up ? '#E0FAE5' : '#FDECEC' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: up ? '#1AB25E' : '#DC2626', fontFamily: font }}>{up ? '+' : ''}{deltaPct}%</span>
            </div>
            <div style={{ fontSize: 14, color: '#9F9FA9', fontFamily: font }}>last 30d</div>
          </div>
        </div>
        <div style={{ marginTop: 'auto', display: 'flex', width: '100%', alignItems: 'flex-end', overflow: 'hidden' }}>
          <Sparkline points={points} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px 2px' }}>
          <span style={{ fontSize: 12, color: '#9F9FA9', fontFamily: font }}>{startLabel}</span>
          <span style={{ fontSize: 12, color: '#9F9FA9', fontFamily: font }}>{endLabel}</span>
        </div>
      </a>
    </div>
  );
};

// ─── AI Visibility card (mockup) ──────────────────────────────────────────────

const AiVisibilityCard = () => (
  <div style={{ border: '1px solid #E4E4E7', background: 'transparent', padding: 16, minWidth: 0, flex: 1, borderRadius: 12 }}>
    <div style={{ position: 'relative', display: 'flex', height: '100%', minHeight: 188, flexDirection: 'column' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 8px 0', marginBottom: 'auto' }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#9F9FA9', fontFamily: font }}>AI Visibility</div>
      </div>
      <div style={{ marginBottom: 16, opacity: 0.8 }}>
        <svg width="100%" height="75" viewBox="0 0 422 75" fill="none" preserveAspectRatio="none">
          <path d="M1 50.4859L7.57459 32.4411L14.1492 36.05L20.7238 50.4859L27.2983 57.583L33.8729 34.2455L40.4475 30.6366L47.0221 46.8769L53.5967 57.583L60.1713 34.2455H66.7459L73.3204 39.659L79.895 57.583L86.4213 41.4635L92.9475 37.8545L99.4738 36.05L106 52.1695M211 56.3799L204.474 40.2604L197.947 42.0649L191.421 45.6738L184.895 61.7934L178.32 43.8693L171.746 38.4559H165.171L158.597 61.7934L152.022 51.0873L145.447 34.8469L138.873 38.4559L132.298 61.7934L125.724 54.6962L119.149 40.2604L112.575 36.6514L106 52.1685M316 39.5356L309.474 23.4171L302.948 25.2216L296.421 28.8305L289.895 44.9501L283.32 27.0261L276.746 21.6126H270.171L263.597 44.9501L257.022 34.244L250.447 18.0036L243.873 21.6126L237.298 44.9501L230.724 37.853L224.149 23.4171L217.575 19.8081L211 56.3768M316 39.5356L322.575 15.5979L329.149 19.2068L335.724 33.6427L342.298 40.7398L348.873 17.4023L355.447 13.7934L362.022 30.0337L368.597 24.7398L375.171 1.40234H381.746L388.32 6.8158L394.895 24.7398L401.421 8.62028L407.947 5.01132L414.474 3.20683L421 19.3264" stroke="var(--gray-40)" />
          <path d="M99.4738 36.05L92.9475 37.8545L86.4213 41.4635L79.895 57.583L73.3204 39.659L66.7459 34.2455H60.1713L53.5967 57.583L47.0221 46.8769L40.4475 30.6366L33.8729 34.2455L27.2983 57.583L20.7238 50.4859L14.1492 36.05L7.57459 32.4411L1 50.4859V74.5977H421V19.3264L414.474 3.20683L407.947 5.01132L401.421 8.62028L394.895 24.7398L388.32 6.8158L381.746 1.40234H375.171L368.597 24.7398L362.022 30.0337L355.447 13.7934L348.873 17.4023L342.298 40.7398L335.724 33.6427L329.149 19.2068L322.575 15.5979L316 39.5356L309.474 23.4171L302.948 25.2216L296.421 28.8305L289.895 44.9501L283.32 27.0261L276.746 21.6126H270.171L263.597 44.9501L257.022 34.244L250.447 18.0036L243.873 21.6126L237.298 44.9501L230.724 37.853L224.149 23.4171L217.575 19.8081L211 56.3768L204.474 40.2604L197.947 42.0649L191.421 45.6738L184.895 61.7934L178.32 43.8693L171.746 38.4559H165.171L158.597 61.7934L152.022 51.0873L145.447 34.8469L138.873 38.4559L132.298 61.7934L125.724 54.6962L119.149 40.2604L112.575 36.6514L106 52.1685L99.4738 36.05Z" fill="url(#aivis_grad)" />
          <defs>
            <linearGradient id="aivis_grad" x1="211" y1="1.40234" x2="211" y2="74.5977" gradientUnits="userSpaceOnUse">
              <stop stopColor="var(--gray-10)" />
              <stop offset="1" stopColor="white" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      <button
        type="button"
        onClick={() => { /* mockup */ }}
        style={{
          position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', whiteSpace: 'nowrap',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '6px 16px', borderRadius: 6,
          fontSize: 14, fontWeight: 600, color: '#3F3F47', background: '#fff', border: 'none', cursor: 'pointer',
          boxShadow: 'inset 0 0 0 1px var(--gray-20)', fontFamily: font, transition: 'background 150ms ease',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#F4F4F5'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#fff'; }}
      >
        Add prompts
      </button>
    </div>
  </div>
);

// ─── Loading skeleton ─────────────────────────────────────────────────────────

const CardSkeleton = () => (
  <div style={{ border: '1px solid #E4E4E7', background: 'transparent', padding: 16, minWidth: 0, flex: 1, borderRadius: 12 }}>
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 188 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 8px 0' }}>
        <Skeleton width={72} height={12} />
        <Skeleton width={120} height={22} />
      </div>
      <Skeleton width="100%" height={90} radius={8} style={{ marginTop: 'auto' }} />
    </div>
  </div>
);

// ─── Section ──────────────────────────────────────────────────────────────────

interface Props {
  total: number;
  deltaPct: number;
  points: number[];
  startLabel: string;
  endLabel: string;
  clicksHref: string;
  loading: boolean;
}

const BrandPerformance = ({ total, deltaPct, points, startLabel, endLabel, clicksHref, loading }: Props) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <SectionHeader icon={<PerfIcon />} label="Brand performance" />
    <div className="dashboard-perf-grid" style={{ display: 'flex', width: '100%', gap: 16, flexDirection: 'column' }}>
      {loading ? (
        <>
          <CardSkeleton />
          <CardSkeleton />
        </>
      ) : (
        <>
          <ClicksCard total={total} deltaPct={deltaPct} points={points} startLabel={startLabel} endLabel={endLabel} href={clicksHref} />
          <AiVisibilityCard />
        </>
      )}
    </div>
  </div>
);

export default BrandPerformance;
