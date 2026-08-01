import React, { useEffect, useMemo, useState } from 'react';
import DomainFavicon from '../common/DomainFavicon';

const F = 'var(--font-family-primary)';

export type PlagiarismMatch = { text: string; url: string; title: string; domain: string; sources: number };
export type PlagiarismResult = { available: boolean; checked: number; matched: number; uniqueness: number; matches: PlagiarismMatch[]; error?: string };

interface Props {
  result: PlagiarismResult;
  onClose: () => void;
  onRescan: () => void;
  rescanning?: boolean;
  readOnly?: boolean;
  /** Push active match sentences + the focused one up to the editor (red highlights). */
  onHighlight?: (sentences: string[], focused: string | null) => void;
}

const IcoX = ({ size = 20 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size}><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg>
);
const IcoArrowLeft = () => (
  <svg viewBox="0 0 24 24" width={20} height={20}><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 12h-15m0 0l6.75 6.75M4.5 12l6.75-6.75" /></svg>
);
const IcoArrowRight = () => (
  <svg viewBox="0 0 24 24" width={16} height={16}><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75" /></svg>
);
const IcoRescan = () => (
  <svg viewBox="0 0 24 24" width={18} height={18}><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.023 9.348h4.992M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
);

// Simple result illustration: two rounded "document" cards + a status badge.
const ResultArt = ({ ok }: { ok: boolean }) => {
  const cardA = ok ? '#9AE6B4' : '#FC8181';
  const cardB = ok ? '#F0FFF4' : '#FED7D7';
  const line = ok ? '#68D391' : '#F56565';
  const lineB = ok ? '#C6F6D5' : '#FEB2B2';
  const badge = ok ? '#38A169' : '#E53E3E';
  return (
    <div style={{ position: 'relative', width: 200, height: 132 }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 56, background: cardA, opacity: 0.7, borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ display: 'block', height: 7, width: '88%', borderRadius: 999, background: line }} />
        <span style={{ display: 'block', height: 7, width: '70%', borderRadius: 999, background: line }} />
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 56, background: cardB, borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ display: 'block', height: 7, width: '70%', borderRadius: 999, background: lineB }} />
        <span style={{ display: 'block', height: 7, width: '88%', borderRadius: 999, background: lineB }} />
      </div>
      <span style={{ position: 'absolute', top: '50%', left: '50%', marginTop: -16, marginLeft: -16, width: 32, height: 32, borderRadius: '50%', background: badge, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        {ok
          ? <svg width={16} height={16} viewBox="0 0 20 20" fill="none"><path d="M16.7 5.2 8.7 15.7l-4.5-4.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          : <span style={{ fontSize: 18, fontWeight: 800, lineHeight: 1 }}>!</span>}
      </span>
    </div>
  );
};

const Favicon = ({ domain }: { domain: string }) => (
  <DomainFavicon domain={domain} size={16} />
);

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
    <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.04em', color: '#9f9fa9' }}>{label}</span>
    <span style={{ fontSize: 15, color: '#18181b', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
  </div>
);
const StatSep = () => <div style={{ width: 1, alignSelf: 'stretch', background: '#f4f4f5', margin: '0 6px' }} />;

const PlagiarismPanel = ({ result, onClose, onRescan, rescanning, readOnly, onHighlight }: Props) => {
  const [ignored, setIgnored] = useState<Set<number>>(new Set());
  const [detail, setDetail] = useState<number | null>(null); // global match index
  const [tab, setTab] = useState<'toFix' | 'fixed' | 'ignored'>('toFix');

  const all = result.matches || [];
  const activeIdx = useMemo(() => all.map((_, i) => i).filter((i) => !ignored.has(i)), [all, ignored]);
  const ignoredIdx = useMemo(() => all.map((_, i) => i).filter((i) => ignored.has(i)), [all, ignored]);
  const sources = useMemo(() => new Set(activeIdx.map((i) => all[i].domain)).size, [activeIdx, all]);
  const plagiarizedPct = Math.max(0, 100 - (result.uniqueness ?? 100));

  // Keep the editor's red highlights in sync: all active sentences, plus the focused one.
  useEffect(() => {
    const active = activeIdx.map((i) => all[i].text);
    const focused = detail !== null && all[detail] ? all[detail].text : null;
    onHighlight?.(active, focused);
  }, [activeIdx, detail, all, onHighlight]);
  // Clear highlights when the panel closes / unmounts.
  useEffect(() => () => { onHighlight?.([], null); }, [onHighlight]);

  const ignore = (i: number) => {
    setIgnored((prev) => { const n = new Set(prev); n.add(i); return n; });
    setDetail(null);
  };

  const Header = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, fontSize: 14, fontWeight: 600, color: '#18181b' }}>
      <span>Plagiarism check</span>
      <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#52525c', display: 'inline-flex', padding: 0 }}><IcoX /></button>
    </div>
  );

  // ── Clean result ────────────────────────────────────────────────
  if (result.matched === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', fontFamily: F }}>
        <Header />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
          <ResultArt ok />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#1AB25E' }}>No plagiarism detected</div>
            <span style={{ fontSize: 13, color: '#52525c' }}>Good job! Your article is plagiarism free.</span>
          </div>
          <button type="button" onClick={onClose} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', color: '#18181b', fontSize: 14, fontWeight: 500, fontFamily: F }}>
            <IcoX /> Close
          </button>
        </div>
      </div>
    );
  }

  // ── Match detail ────────────────────────────────────────────────
  if (detail !== null && all[detail]) {
    const m = all[detail];
    const pos = activeIdx.indexOf(detail);
    const prev = pos > 0 ? activeIdx[pos - 1] : null;
    const next = pos >= 0 && pos < activeIdx.length - 1 ? activeIdx[pos + 1] : null;
    const goto = (idx: number | null) => { if (idx === null) return; setDetail(idx); };
    const NavBtn = ({ dir, idx }: { dir: 'prev' | 'next'; idx: number | null }) => (
      <button type="button" disabled={idx === null} onClick={() => goto(idx)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: 'none', fontSize: 13, fontWeight: 600, fontFamily: F, cursor: idx === null ? 'not-allowed' : 'pointer', opacity: idx === null ? 0.5 : 1, background: dir === 'next' ? '#18181b' : '#f4f4f5', color: dir === 'next' ? '#fff' : '#18181b' }}>
        {dir === 'prev' && <IcoArrowLeft />}<span>{dir === 'prev' ? 'Prev' : 'Next'}</span>{dir === 'next' && <IcoArrowRight />}
      </button>
    );
    return (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', fontFamily: F }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="button" onClick={() => setDetail(null)} aria-label="Back" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#3f3f47', display: 'inline-flex', padding: 0 }}><IcoArrowLeft /></button>
            <span style={{ fontSize: 15, fontWeight: 500, color: '#18181b' }}>Plagiarism match</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}><NavBtn dir="prev" idx={prev} /><NavBtn dir="next" idx={next} /></div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: '#18181b' }}>Plagiarised sentence</span>
          <div style={{ border: '1px solid #d4d4d8', borderRadius: 8, padding: 10 }}>
            <span style={{ fontSize: 13, lineHeight: '20px', color: '#E5484D' }}>{m.text}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, fontSize: 13, color: '#52525c' }}>
            <span style={{ flexShrink: 0 }}>Found on</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <Favicon domain={m.domain} />
              <a href={m.url} target="_blank" rel="noreferrer noopener" style={{ fontSize: 13, color: '#2563eb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.url}</a>
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '8px 16px' }}>
          <button type="button" disabled={readOnly} onClick={() => ignore(detail)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 20px', borderRadius: 8, border: 'none', background: '#f4f4f5', color: '#18181b', fontSize: 14, fontWeight: 600, cursor: readOnly ? 'not-allowed' : 'pointer', fontFamily: F, transition: 'background 0.15s' }}
            onMouseEnter={(e) => { if (!readOnly) e.currentTarget.style.background = '#e4e4e7'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#f4f4f5'; }}>
            <IcoX size={18} /> Ignore this plagiarism
          </button>
          <span style={{ fontSize: 12, color: '#71717b', textAlign: 'center' }}>The sentence will be moved to the ignored list and won&apos;t be considered in your Plagiarism score</span>
        </div>
      </div>
    );
  }

  // ── List view ───────────────────────────────────────────────────
  const list = tab === 'toFix' ? activeIdx : tab === 'ignored' ? ignoredIdx : [];
  const Tab = ({ id, label, count }: { id: 'toFix' | 'fixed' | 'ignored'; label: string; count: number }) => (
    <button type="button" onClick={() => setTab(id)}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 14px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, fontWeight: 500, fontFamily: F, color: tab === id ? '#F84416' : '#3f3f47', boxShadow: tab === id ? 'inset 0 -2px 0 0 #F84416' : 'none' }}>
      {label}
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 18, height: 18, padding: '0 5px', borderRadius: 4, fontSize: 11, fontWeight: 700, color: '#fff', background: id === 'toFix' ? '#F84416' : '#9f9fa9' }}>{count}</span>
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', fontFamily: F }}>
      <Header />
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }} className="styled-scrollbar">
        {/* Summary */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 16px 0' }}>
          <ResultArt ok={false} />
          <span style={{ padding: '16px 0', fontSize: 14, color: '#E5484D' }}>{plagiarizedPct}% of content has been plagiarized</span>
          <div style={{ display: 'flex', alignItems: 'stretch' }}>
            <Stat label="MATCHES" value={activeIdx.length} />
            <StatSep />
            <Stat label="SENTENCES" value={activeIdx.length} />
            <StatSep />
            <Stat label="PARAGRAPHS" value={0} />
            <StatSep />
            <Stat label="SOURCES" value={sources} />
          </div>
        </div>

        {/* Rescan row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid #f4f4f5' }}>
          <span style={{ fontSize: 13, color: '#52525c' }}>Re-check against the web anytime.</span>
          <button type="button" disabled={!!rescanning || readOnly} onClick={onRescan}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 6, border: 'none', background: '#18181b', color: '#fff', fontSize: 13, fontWeight: 600, cursor: (rescanning || readOnly) ? 'not-allowed' : 'pointer', opacity: (rescanning || readOnly) ? 0.6 : 1, fontFamily: F }}>
            <IcoRescan /> Rescan
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px 0' }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: '#18181b' }}>Plagiarism matches</span>
        </div>
        <div style={{ display: 'flex', padding: '0 8px', borderBottom: '1px solid #f4f4f5' }}>
          <Tab id="toFix" label="To fix" count={activeIdx.length} />
          <Tab id="fixed" label="Fixed" count={0} />
          <Tab id="ignored" label="Ignored" count={ignoredIdx.length} />
        </div>

        {/* Match list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12 }}>
          {list.length === 0 && (
            <span style={{ fontSize: 13, color: '#9f9fa9', textAlign: 'center', padding: '12px 0' }}>
              {tab === 'toFix' ? 'Nothing to fix.' : tab === 'fixed' ? 'No fixed matches.' : 'No ignored matches.'}
            </span>
          )}
          {list.map((i) => {
            const m = all[i];
            const isIgnored = tab === 'ignored';
            return (
              <div key={i} style={{ border: '1px solid #f4f4f5', borderRadius: 12, padding: 12, background: '#fff', opacity: isIgnored ? 0.7 : 1 }}>
                {!isIgnored && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="button" onClick={() => ignore(i)} aria-label="Ignore" title="Ignore this match" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9f9fa9', display: 'inline-flex', padding: 0 }}><IcoX size={16} /></button>
                  </div>
                )}
                <button type="button" onClick={() => setDetail(i)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, fontFamily: F }}>
                  <span style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: 13, lineHeight: '19px', color: isIgnored ? '#71717b' : '#E5484D' }}>{m.text}</span>
                </button>
                <div style={{ minHeight: 1, background: 'linear-gradient(to right, #e4e4e7 50%, transparent 50%)', backgroundSize: '8px 1px', margin: '10px 0' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <Favicon domain={m.domain} />
                  <a href={m.url} target="_blank" rel="noreferrer noopener" style={{ fontSize: 12, color: '#2563eb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{m.url}</a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PlagiarismPanel;
