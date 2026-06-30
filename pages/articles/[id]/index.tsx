import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import AppShell from '../../../components/common/AppShell';
import ContentScorePanel from '../../../components/articles/ContentScorePanel';
import InternalLinksPanel from '../../../components/articles/InternalLinksPanel';
import KeywordSuggestInput from '../../../components/articles/KeywordSuggestInput';
import PixabayImageModal from '../../../components/articles/PixabayImageModal';
import VersionHistoryPanel from '../../../components/articles/VersionHistoryPanel';
import CustomizationPanelModal from '../../../components/articles/CustomizationPanelModal';
import EditorOnboarding from '../../../components/articles/EditorOnboarding';
import { Thread, CommentAuthor } from '../../../components/articles/comments/CommentThreadBubble';
import EditorLoading from '../../../components/articles/EditorLoading';
import CompareVersionsModal from '../../../components/articles/CompareVersionsModal';
import AiGlowRing from '../../../components/articles/AiGlowRing';
import { authClient } from '../../../lib/auth/client';
import { useFetchDomains } from '../../../services/domains';
import { useFetchSettings } from '../../../services/settings';
import { useContentSettings } from '../../../services/contentSettings';
import { useArticleKeywords } from '../../../services/articleKeywords';
import { ScoreData, countOccurrences, computeContentScore, computeContentScoreBreakdown } from '../../../lib/contentScore';
import type { AiVisibilitySummary } from '../../../lib/aiSearchScore';
import { getErrorMessage } from '../../../lib/errors';
import { buildReviewDoc } from '../../../lib/optimizeReviewDoc';
import type { SectionEvent } from '../../../lib/optimizeSectionEvents';
import { optimizeStore } from '../../../components/articles/optimizeStore';
import { useArticleChannel } from '../../../lib/ably/useArticleChannel';
import { ABLY_EVENTS } from '../../../lib/ably/channel';
import { throttle } from '../../../lib/throttle';
import dynamic from 'next/dynamic';

const ArticleEditor = dynamic(() => import('../../../components/articles/ArticleEditor'), { ssr: false });
import type { HeadingItem } from '../../../components/articles/ArticleEditor';

interface Article {
  id: number;
  domain_id: number;
  title: string;
  content: string;
  status: string;
  target_keyword: string;
  meta_title: string;
  meta_description: string;
  meta_url: string;
  schema_json: string;
  score_data: string;
  content_score?: number;
  word_count: number;
  featured_image: string | null;
  publish_target: string | null;
  publish_url: string | null;
  competitor_outlines_cache: string | null;
  ai_visibility_summary?: AiVisibilitySummary | null;
  language?: string;
  created_at?: string;
  updated_at?: string;
}

/* ── Icon button used in the top action bar ──────────────────────── */
const IconBtn = ({
  children, onClick, disabled, title, danger, active,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  danger?: boolean;
  active?: boolean;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: 32, height: 32, borderRadius: 8, border: 'none',
      background: active ? '#f4f4f5' : 'transparent', cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.4 : 1,
      color: danger ? '#dc2626' : (active ? '#18181b' : '#3f3f47'),
      padding: 0, transition: 'color 0.15s, background 0.15s',
      fontFamily: 'var(--font-family-primary)',
    }}
    onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.color = danger ? '#b91c1c' : '#09090b'; }}
    onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.color = danger ? '#dc2626' : '#3f3f47'; }}
  >
    {children}
  </button>
);

/* ── Surfer-style action-bar icons (20px) ─────────────────────────── */
const sIco = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const IcoDoneFilled = () => (<svg width={20} height={20} viewBox="0 0 24 24"><path fillRule="evenodd" clipRule="evenodd" fill="currentColor" d="M12 1C5.92487 1 1 5.92487 1 12C1 18.0751 5.92487 23 12 23C18.0751 23 23 18.0751 23 12C23 5.92487 18.0751 1 12 1ZM17.2071 9.70711C17.5976 9.31658 17.5976 8.68342 17.2071 8.29289C16.8166 7.90237 16.1834 7.90237 15.7929 8.29289L10.5 13.5858L8.20711 11.2929C7.81658 10.9024 7.18342 10.9024 6.79289 11.2929C6.40237 11.6834 6.40237 12.3166 6.79289 12.7071L9.79289 15.7071C10.1834 16.0976 10.8166 16.0976 11.2071 15.7071L17.2071 9.70711Z" /></svg>);
const IcoDoneOutline = () => (<svg width={20} height={20} viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" {...sIco} /><path {...sIco} d="M8.4 12.3l2.4 2.4 4.8-5.4" /></svg>);
const IcoClock = () => (<svg width={20} height={20} viewBox="0 0 24 24"><path {...sIco} d="M22.7 13.5L20.7005 11.5L18.7 13.5M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C15.3019 3 18.1885 4.77814 19.7545 7.42909M12 7V12L15 14" /></svg>);
const IcoVoice = () => (<svg width={20} height={20} viewBox="0 0 24 24"><path {...sIco} d="M3 10L3 14M7.5 11V13M12 6V18M16.5 3V21M21 10V14" /></svg>);
const IcoGear = () => (<svg width={20} height={20} viewBox="0 0 24 24"><path {...sIco} d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" /><path {...sIco} d="M18.7273 14.7273C18.6063 15.0015 18.5702 15.3056 18.6236 15.6005C18.6771 15.8954 18.8177 16.1676 19.0273 16.3818L19.0818 16.4364C19.2509 16.6052 19.385 16.8057 19.4765 17.0265C19.568 17.2472 19.6151 17.4838 19.6151 17.7227C19.6151 17.9617 19.568 18.1983 19.4765 18.419C19.385 18.6397 19.2509 18.8402 19.0818 19.0091C18.913 19.1781 18.7124 19.3122 18.4917 19.4037C18.271 19.4952 18.0344 19.5423 17.7955 19.5423C17.5565 19.5423 17.3199 19.4952 17.0992 19.4037C16.8785 19.3122 16.678 19.1781 16.5091 19.0091L16.4545 18.9545C16.2403 18.745 15.9682 18.6044 15.6733 18.5509C15.3784 18.4974 15.0742 18.5335 14.8 18.6545C14.5311 18.7698 14.3018 18.9611 14.1403 19.205C13.9788 19.4489 13.8921 19.7347 13.8909 20.0273V20.1818C13.8909 20.664 13.6994 21.1265 13.3584 21.4675C13.0174 21.8084 12.5549 22 12.0727 22C11.5905 22 11.1281 21.8084 10.7871 21.4675C10.4461 21.1265 10.2545 20.664 10.2545 20.1818V20.1C10.2475 19.7991 10.1501 19.5073 9.97501 19.2625C9.79991 19.0176 9.55521 18.8312 9.27273 18.7273C8.99853 18.6063 8.69437 18.5702 8.39947 18.6236C8.10456 18.6771 7.83244 18.8177 7.61818 19.0273L7.56364 19.0818C7.39478 19.2509 7.19425 19.385 6.97353 19.4765C6.7528 19.568 6.51621 19.6151 6.27727 19.6151C6.03834 19.6151 5.80174 19.568 5.58102 19.4765C5.36029 19.385 5.15977 19.2509 4.99091 19.0818C4.82186 18.913 4.68775 18.7124 4.59626 18.4917C4.50476 18.271 4.45766 18.0344 4.45766 17.7955C4.45766 17.5565 4.50476 17.3199 4.59626 17.0992C4.68775 16.8785 4.82186 16.678 4.99091 16.5091L5.04545 16.4545C5.25503 16.2403 5.39562 15.9682 5.4491 15.6733C5.50257 15.3784 5.46647 15.0742 5.34545 14.8C5.23022 14.5311 5.03887 14.3018 4.79497 14.1403C4.55107 13.9788 4.26526 13.8921 3.97273 13.8909H3.81818C3.33597 13.8909 2.87351 13.6994 2.53253 13.3584C2.19156 13.0174 2 12.5549 2 12.0727C2 11.5905 2.19156 11.1281 2.53253 10.7871C2.87351 10.4461 3.33597 10.2545 3.81818 10.2545H3.9C4.2009 10.2475 4.49273 10.1501 4.73754 9.97501C4.98236 9.79991 5.16883 9.55521 5.27273 9.27273C5.39374 8.99853 5.42984 8.69437 5.37637 8.39947C5.3229 8.10456 5.18231 7.83244 4.97273 7.61818L4.91818 7.56364C4.74913 7.39478 4.61503 7.19425 4.52353 6.97353C4.43203 6.7528 4.38493 6.51621 4.38493 6.27727C4.38493 6.03834 4.43203 5.80174 4.52353 5.58102C4.61503 5.36029 4.74913 5.15977 4.91818 4.99091C5.08704 4.82186 5.28757 4.68775 5.50829 4.59626C5.72901 4.50476 5.96561 4.45766 6.20455 4.45766C6.44348 4.45766 6.68008 4.50476 6.9008 4.59626C7.12152 4.68775 7.32205 4.82186 7.49091 4.99091L7.54545 5.04545C7.75971 5.25503 8.03183 5.39562 8.32674 5.4491C8.62164 5.50257 8.9258 5.46647 9.2 5.34545H9.27273C9.54161 5.23022 9.77093 5.03887 9.93245 4.79497C10.094 4.55107 10.1807 4.26526 10.1818 3.97273V3.81818C10.1818 3.33597 10.3734 2.87351 10.7144 2.53253C11.0553 2.19156 11.5178 2 12 2C12.4822 2 12.9447 2.19156 13.2856 2.53253C13.6266 2.87351 13.8182 3.33597 13.8182 3.81818V3.9C13.8193 4.19253 13.906 4.47834 14.0676 4.72224C14.2291 4.96614 14.4584 5.15749 14.7273 5.27273C15.0015 5.39374 15.3056 5.42984 15.6005 5.37637C15.8954 5.3229 16.1676 5.18231 16.3818 4.97273L16.4364 4.91818C16.6052 4.74913 16.8057 4.61503 17.0265 4.52353C17.2472 4.43203 17.4838 4.38493 17.7227 4.38493C17.9617 4.38493 18.1983 4.43203 18.419 4.52353C18.6397 4.61503 18.8402 4.74913 19.0091 4.91818C19.1781 5.08704 19.3122 5.28757 19.4037 5.50829C19.4952 5.72901 19.5423 5.96561 19.5423 6.20455C19.5423 6.44348 19.4952 6.68008 19.4037 6.9008C19.3122 7.12152 19.1781 7.32205 19.0091 7.49091L18.9545 7.54545C18.745 7.75971 18.6044 8.03183 18.5509 8.32674C18.4974 8.62164 18.5335 8.9258 18.6545 9.2V9.27273C18.7698 9.54161 18.9611 9.77093 19.205 9.93245C19.4489 10.094 19.7347 10.1807 20.0273 10.1818H20.1818C20.664 10.1818 21.1265 10.3734 21.4675 10.7144C21.8084 11.0553 22 11.5178 22 12C22 12.4822 21.8084 12.9447 21.4675 13.2856C21.1265 13.6266 20.664 13.8182 20.1818 13.8182H20.1C19.8075 13.8193 19.5217 13.906 19.2778 14.0676C19.0339 14.2291 18.8425 14.4584 18.7273 14.7273Z" /></svg>);
const IcoPanel = () => (<svg width={20} height={20} viewBox="0 0 24 24"><path {...sIco} d="M15 3V21M7.8 3H16.2C17.8802 3 18.7202 3 19.362 3.32698C19.9265 3.6146 20.3854 4.07354 20.673 4.63803C21 5.27976 21 6.11984 21 7.8V16.2C21 17.8802 21 18.7202 20.673 19.362C20.3854 19.9265 19.9265 20.3854 19.362 20.673C18.7202 21 17.8802 21 16.2 21H7.8C6.11984 21 5.27976 21 4.63803 20.673C4.07354 20.3854 3.6146 19.9265 3.32698 19.362C3 18.7202 3 17.8802 3 16.2V7.8C3 6.11984 3 5.27976 3.32698 4.63803C3.6146 4.07354 4.07354 3.6146 4.63803 3.32698C5.27976 3 6.11984 3 7.8 3Z" /></svg>);
const IcoDots = () => (<svg width={20} height={20} viewBox="0 0 24 24"><path fill="currentColor" fillRule="evenodd" clipRule="evenodd" d="M10 12C10 10.8954 10.8954 10 12 10C13.1046 10 14 10.8954 14 12C14 13.1046 13.1046 14 12 14C10.8954 14 10 13.1046 10 12Z" /><path fill="currentColor" fillRule="evenodd" clipRule="evenodd" d="M17 12C17 10.8954 17.8954 10 19 10C20.1046 10 21 10.8954 21 12C21 13.1046 20.1046 14 19 14C17.8954 14 17 13.1046 17 12Z" /><path fill="currentColor" fillRule="evenodd" clipRule="evenodd" d="M3 12C3 10.8954 3.89543 10 5 10C6.10457 10 7 10.8954 7 12C7 13.1046 6.10457 14 5 14C3.89543 14 3 13.1046 3 12Z" /></svg>);
const IcoChevronR = () => (<svg width={18} height={18} viewBox="0 0 24 24"><path {...sIco} d="m9 18l6-6l-6-6" /></svg>);

/* Menu row used by the ⋯ actions menu */
const MenuRow = ({ icon, label, sub, chevron, onClick }: { icon: React.ReactNode; label: string; sub?: string; chevron?: boolean; onClick?: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '8px 14px',
      border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left',
      fontFamily: 'var(--font-family-primary)', color: '#18181B',
    }}
    onMouseEnter={(e) => { e.currentTarget.style.background = '#f8f8f9'; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
  >
    <span style={{ color: '#18181B', display: 'inline-flex', flexShrink: 0 }}>{icon}</span>
    <span style={{ flex: 1, minWidth: 0 }}>
      <span style={{ display: 'block', fontSize: 15, fontWeight: 500, lineHeight: '20px' }}>{label}</span>
      {sub && <span style={{ display: 'block', fontSize: 12, color: '#71717b', lineHeight: '16px' }}>{sub}</span>}
    </span>
    {chevron && <span style={{ color: '#71717b', display: 'inline-flex', flexShrink: 0 }}><IcoChevronR /></span>}
  </button>
);

/* Voice picker popover (Search voices / SERP based / Custom voices / Add Custom Voice) */
const Check18 = () => (<svg viewBox="0 0 20 20" width={18} height={18} style={{ marginLeft: 'auto' }}><path fill="#18181B" fillRule="evenodd" d="M16.705 4.153a.75.75 0 0 1 .142 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893l7.48-9.817a.75.75 0 0 1 1.05-.143" clipRule="evenodd" /></svg>);

const VoicePopover = ({ style }: { style?: React.CSSProperties }) => {
  const router = useRouter();
  const [voices, setVoices] = useState<{ id: string; name: string; description: string; isDefault: boolean }[]>([]);
  const [selected, setSelected] = useState('serp');
  const [q, setQ] = useState('');

  const { data: contentSettings } = useContentSettings();
  const seeded = useRef(false);
  useEffect(() => {
    if (!contentSettings || seeded.current) return;
    seeded.current = true;
    setVoices(contentSettings.voices as { id: string; name: string; description: string; isDefault: boolean }[]);
    const def = contentSettings.voices.find((v) => v.isDefault);
    if (def) setSelected(def.id);
  }, [contentSettings]);

  const ql = q.trim().toLowerCase();
  const filtered = ql ? voices.filter((v) => v.name.toLowerCase().includes(ql)) : voices;
  const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 15, fontWeight: 500, color: '#18181B', fontFamily: 'var(--font-family-primary)', textAlign: 'left' };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        background: '#fff', borderRadius: 12, padding: '8px 0', minWidth: 280, maxWidth: 320,
        boxShadow: '0px 8px 24px rgba(24,26,34,0.16), 0px 2px 6px rgba(24,26,34,0.08)',
        animation: 'growOut 0.18s cubic-bezier(0.16,1,0.3,1)', fontFamily: 'var(--font-family-primary)', ...style,
      }}
    >
      <div style={{ padding: '4px 12px 8px' }}>
        <input
          placeholder="Search voices" value={q} onChange={(e) => setQ(e.target.value)} onClick={(e) => e.stopPropagation()}
          style={{ width: '100%', height: 40, padding: '0 12px', boxSizing: 'border-box', borderRadius: 8, border: '1px solid #d4d4d8', outline: 'none', fontSize: 14, fontFamily: 'var(--font-family-primary)', color: '#18181B' }}
        />
      </div>

      <div style={{ maxHeight: 240, overflowY: 'auto' }} className="styled-scrollbar">
        <div style={{ padding: '6px 16px 4px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#9f9fa9', letterSpacing: '0.04em' }}>Built-in voices</div>
        <button type="button" onClick={() => setSelected('serp')} style={rowStyle}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#f8f8f9'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
          <span style={{ flex: 1 }}>SERP based</span>
          {selected === 'serp' && <Check18 />}
        </button>
        {filtered.map((v) => (
          <button key={v.id} type="button" onClick={() => setSelected(v.id)} style={rowStyle}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f8f8f9'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</span>
            {selected === v.id && <Check18 />}
          </button>
        ))}
      </div>

      <div style={{ height: 1, background: '#f4f4f5', margin: '4px 0' }} />
      <button type="button" onClick={() => router.push('/settings/custom_voices')} style={rowStyle}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#f8f8f9'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
        <svg viewBox="0 0 24 24" width={18} height={18}><path d="M12 5v14M5 12h14" stroke="#18181B" strokeWidth={2} strokeLinecap="round" /></svg>
        Add Custom Voice
      </button>
    </div>
  );
};

/* Share popover (edit link + comment link, like Surfer) */
const IcoReset = () => (
  <svg viewBox="0 0 24 24" width={18} height={18}><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M3.5 9a8.5 8.5 0 0 1 14.4-3.1L21 9M21 5v4h-4M20.5 15a8.5 8.5 0 0 1-14.4 3.1L3 15M3 19v-4h4" /></svg>
);


const ShareLinkBlock = ({ desc, link, onReset, copyLabel, loading }: { desc: React.ReactNode; link: string; onReset: () => void; copyLabel: string; loading?: boolean }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (loading) return;
    navigator.clipboard?.writeText(link).then(() => {
      setCopied(true);
      toast.success('Link copied');
      setTimeout(() => setCopied(false), 1600);
    }).catch(() => toast.error('Copy failed'));
  };
  return (
    <div style={{ paddingBottom: 4 }}>
      <style>{`@keyframes shimmer { 0% { background-position: -200px 0; } 100% { background-position: 200px 0; } }`}</style>
      <div style={{ fontSize: 14, color: '#3f3f47', lineHeight: '20px', paddingBottom: 10 }}>{desc}</div>
      <div style={{ background: '#f8f8f9', padding: '9px 14px', borderRadius: 8, minHeight: 38, display: 'flex', alignItems: 'center' }}>
        {loading ? (
          <span style={{ display: 'block', width: '70%', height: 14, borderRadius: 6, background: 'linear-gradient(90deg, #ececef 0px, #f6f6f8 80px, #ececef 160px)', backgroundSize: '200px 100%', animation: 'shimmer 1.1s linear infinite' }} />
        ) : (
          <a href={link} title={link} rel="noreferrer noopener" target="_blank"
            style={{ display: 'block', width: '100%', fontSize: 14, color: '#52525c', textDecoration: 'underline', textUnderlineOffset: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {link.replace(/^https?:\/\//, '')}
          </a>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14 }}>
        <button type="button" onClick={onReset} disabled={loading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', background: 'transparent', padding: 0, cursor: loading ? 'default' : 'pointer', fontSize: 14, fontWeight: 600, color: '#e5484d', opacity: loading ? 0.5 : 1, fontFamily: 'var(--font-family-primary)' }}>
          <IcoReset /> Reset link
        </button>
        <button type="button" onClick={copy} disabled={loading}
          style={{ padding: '7px 16px', borderRadius: 6, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600, color: '#fff', background: copied ? '#1ab25e' : '#18181b', opacity: loading ? 0.5 : 1, fontFamily: 'var(--font-family-primary)', transition: 'background 0.15s' }}
          onMouseEnter={(e) => { if (!copied && !loading) e.currentTarget.style.background = '#783afb'; }}
          onMouseLeave={(e) => { if (!copied) e.currentTarget.style.background = '#18181b'; }}>
          {copied ? 'Copied' : copyLabel}
        </button>
      </div>
    </div>
  );
};

const SharePopover = ({ articleId, onClose, style }: { articleId: string; onClose: () => void; style?: React.CSSProperties }) => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const [token, setToken] = useState('');

  useEffect(() => {
    fetch(`/api/articles/${articleId}/share-link`).then((r) => r.json()).then((d) => { if (d.token) setToken(d.token); }).catch(() => {});
  }, [articleId]);

  const resetLink = async () => {
    try {
      const r = await fetch(`/api/articles/${articleId}/share-link`, { method: 'POST' });
      const d = await r.json();
      if (d.token) { setToken(d.token); toast.success('Comment link reset'); }
    } catch { toast.error('Could not reset link'); }
  };

  // Read-only preview/comment link — opens the shared draft view via opaque token.
  const commentLink = token ? `${origin}/drafts/s/${token}` : `${origin}/drafts/s/…`;
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        background: '#fff', borderRadius: 12, padding: 20, width: 360, maxWidth: 'calc(100vw - 24px)',
        boxShadow: '0px 8px 24px rgba(24,26,34,0.16), 0px 2px 6px rgba(24,26,34,0.08)',
        animation: 'growOut 0.18s cubic-bezier(0.16,1,0.3,1)', fontFamily: 'var(--font-family-primary)', ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingBottom: 16 }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: '#18181B' }}>Share Content Editor</span>
        <button type="button" aria-label="Close" onClick={onClose}
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: '#52525c', display: 'inline-flex', lineHeight: 1 }}>
          <svg viewBox="0 0 24 24" width={20} height={20}><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <ShareLinkBlock
        desc={<>Anyone with this link can <span style={{ fontWeight: 600, color: '#18181B' }}>view</span> and <span style={{ fontWeight: 600, color: '#18181B' }}>comment,</span> for an unlimited time</>}
        link={commentLink} copyLabel="Copy comment link" onReset={resetLink} loading={!token}
      />
    </div>
  );
};

/* ── Content Editor breadcrumb (replaces workspace switcher in the topbar) ── */
const BC_COUNTRY: Record<string, { name: string; cc: string }> = {
  pl: { name: 'Poland', cc: 'pl' }, en: { name: 'United States', cc: 'us' }, de: { name: 'Germany', cc: 'de' },
  fr: { name: 'France', cc: 'fr' }, es: { name: 'Spain', cc: 'es' }, it: { name: 'Italy', cc: 'it' },
  nl: { name: 'Netherlands', cc: 'nl' }, pt: { name: 'Portugal', cc: 'pt' },
};

const bcFmtDate = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', ' at');
};

const BcChevron = () => (
  <svg viewBox="0 0 24 24" width={20} height={20} style={{ flexShrink: 0, color: '#3F3F47' }}>
    <path fill="currentColor" fillRule="evenodd" clipRule="evenodd" d="M8.293 5.293a1 1 0 0 1 1.414 0l6 6a1 1 0 0 1 0 1.414l-6 6a1 1 0 0 1-1.414-1.414L13.586 12 8.293 6.707a1 1 0 0 1 0-1.414" />
  </svg>
);

const EditorBreadcrumb = ({ domain, title, keywords, language, createdAt, modifiedAt }: {
  domain: string; title: string; keywords: string[]; language?: string; createdAt?: string; modifiedAt?: string;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const loc = BC_COUNTRY[(language || 'pl').toLowerCase()] || BC_COUNTRY.en;
  const kwList = keywords.length ? keywords : [];
  const f = 'var(--font-family-primary)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, paddingLeft: 8 }}>
      <Link href="/dashboard" style={{ display: 'inline-flex', flexShrink: 0 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8 }}>
          <img alt="" width={20} height={20} style={{ borderRadius: 4 }} src={`https://www.google.com/s2/favicons?domain=${domain || 'serpbear'}&sz=32`} />
        </span>
      </Link>
      <div className="ce-bc-rest" style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <BcChevron />
      <Link href="/articles" style={{ color: '#9F9FA9', fontWeight: 600, whiteSpace: 'nowrap', textDecoration: 'none', fontFamily: f, fontSize: 14 }}>Content Editor</Link>
      <BcChevron />
      <div ref={ref} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, position: 'relative' }}>
        <span style={{ display: 'block', color: '#fff', fontWeight: 600, fontFamily: f, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, maxWidth: 'min(460px, 34vw)' }}>{title || 'Untitled'}</span>
        <button type="button" aria-label="Article info" onClick={() => setOpen((v) => !v)}
          style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', color: '#9F9FA9', display: 'inline-flex', flexShrink: 0 }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.color = '#9F9FA9'; }}>
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 16v-4M12 8h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" /></svg>
        </button>

        {open && (
          <div onClick={(e) => e.stopPropagation()}
            style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 200, width: 300, maxWidth: 'calc(100vw - 24px)', background: '#fff', borderRadius: 12, padding: '12px 16px', boxShadow: '0px 8px 24px rgba(24,26,34,0.16), 0px 2px 6px rgba(24,26,34,0.08)', display: 'flex', flexDirection: 'column', gap: 14, fontFamily: f, animation: 'growOut 0.18s cubic-bezier(0.16,1,0.3,1)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                <span style={{ fontSize: 13, color: '#52525C' }}>Keywords{kwList.length ? ` (${kwList.length})` : ''}</span>
                <span style={{ fontSize: 14, fontWeight: 500, color: '#18181B', wordBreak: 'break-word' }}>{kwList.length ? kwList.join(', ') : '—'}</span>
              </div>
              {kwList.length > 0 && (
                <button type="button" aria-label="Copy keywords" onClick={() => { navigator.clipboard?.writeText(kwList.join(', ')); toast.success('Keywords copied'); }}
                  style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', color: '#3F3F47', display: 'inline-flex', flexShrink: 0 }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#18181B'; }} onMouseLeave={(e) => { e.currentTarget.style.color = '#3F3F47'; }}>
                  <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}><path d="M16.5 8.25V6a2.25 2.25 0 0 0-2.25-2.25H6A2.25 2.25 0 0 0 3.75 6v8.25A2.25 2.25 0 0 0 6 16.5h2.25m8.25-8.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-7.5A2.25 2.25 0 0 1 8.25 18v-1.5m8.25-8.25h-6a2.25 2.25 0 0 0-2.25 2.25v6" /></svg>
                </button>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 13, color: '#52525C' }}>Location</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 500, color: '#18181B' }}>
                <img alt="" width={18} height={13} style={{ borderRadius: 2 }} src={`https://cdn.jsdelivr.net/npm/flag-icons@6.11.1/flags/4x3/${loc.cc}.svg`} />
                {loc.name}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 13, color: '#52525C' }}>Last Modified</span>
              <span style={{ fontSize: 14, fontWeight: 500, color: '#18181B' }}>{bcFmtDate(modifiedAt)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 13, color: '#52525C' }}>Created</span>
              <span style={{ fontSize: 14, fontWeight: 500, color: '#18181B' }}>{bcFmtDate(createdAt)}</span>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

const ArticleEditorPage: NextPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const { data: domainsData } = useFetchDomains(router);
  const { data: appSettingsData } = useFetchSettings();
  const appSettings: SettingsType = appSettingsData?.settings || {};
  const domains: DomainType[] = domainsData?.domains || [];

  const editorRef = useRef<any>(null);
  const pixabayCallbackRef = useRef<((img: { url: string; alt: string }) => void) | null>(null);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false); // true while a save PUT is in flight (prevents overlapping saves)
  const lastSavedSig = useRef<string | null>(null);
  const lastVersionAt = useRef(0);
  const flushRef = useRef<((unload?: boolean) => void) | null>(null);
  const [article, setArticle] = useState<Article | null>(null);
  const [highlightTerms, setHighlightTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [autoSaveState, setAutoSaveState] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [showPixabay, setShowPixabay] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddDomain, setShowAddDomain] = useState(false);
  const [showInternalLinksPanel, setShowInternalLinksPanel] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  // Surfy docks into the right panel: ArticleEditor notifies open-state; the dock <div> is the portal target.
  const [surfyDockOpen, setSurfyDockOpen] = useState(false);
  const [surfyDockEl, setSurfyDockEl] = useState<HTMLElement | null>(null);
  const [showCustomization, setShowCustomization] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [actionsMenu, setActionsMenu] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [commentThreads, setCommentThreads] = useState<Thread[]>([]);
  const [commentsVersion, setCommentsVersion] = useState(0);
  // Comment identity = signed-in user + Google/GSC profile photo (same source as the topbar).
  const session = authClient.useSession?.();
  const [gscPicture, setGscPicture] = useState('');
  useEffect(() => {
    fetch('/api/gsc/accounts', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { const a = d?.accounts?.[0]; if (a?.picture) setGscPicture(a.picture); })
      .catch(() => {});
  }, []);
  const commentAuthor: CommentAuthor = useMemo(() => ({
    name: session?.data?.user?.name || session?.data?.user?.email || 'You',
    color: '#783AFB',
    avatar: gscPicture || undefined,
  }), [session?.data?.user?.name, session?.data?.user?.email, gscPicture]);
  const actionsRef = useRef<HTMLDivElement>(null);
  const voiceRef = useRef<HTMLDivElement>(null);
  const shareRef = useRef<HTMLDivElement>(null);
  const [domainBaseUrl, setDomainBaseUrl] = useState('');
  const [linkBar, setLinkBar] = useState<{ count: number; preLinkHtml: string; positions: number[] } | null>(null);
  const [linkNavIdx, setLinkNavIdx] = useState(0);
  const [autoOptimizeBar, setAutoOptimizeBar] = useState<{ preHtml: string } | null>(null);
  // AI Readability "Apply All" → structure-only optimize, reviewed via its own bottom bar.
  const [isApplyingReadability, setIsApplyingReadability] = useState(false);
  const [readabilityBar, setReadabilityBar] = useState<{ preHtml: string } | null>(null);
  // Bumped when the readability optimize is Accepted → the panel marks its suggestions done.
  const [readabilityAcceptKey, setReadabilityAcceptKey] = useState(0);
  // "Compare versions" modal — ORIGINAL (pre-optimize) vs NEW (current editor) side-by-side diff.
  const [compareVersions, setCompareVersions] = useState<{ original: string; updated: string } | null>(null);
  // Plagiarism highlights pushed up from the Plagiarism panel → red underlines in the editor.
  const [plagSentences, setPlagSentences] = useState<string[]>([]);
  const [plagFocused, setPlagFocused] = useState<string | null>(null);
  const handlePlagiarismHighlight = useCallback((sentences: string[], focused: string | null) => {
    setPlagSentences(sentences);
    setPlagFocused(focused);
  }, []);
  const [isAutoOptimizing, setIsAutoOptimizing] = useState(false);
  const [autoOptimizeStatus, setAutoOptimizeStatus] = useState('Optimizing article…');
  // AO-7: section-by-section Auto-Optimize state machine (idle → optimizing → reviewing).
  // `isAutoOptimizing` stays true for the whole flow so autosave + the panel button-disable hold.
  const [optimizeState, setOptimizeState] = useState<'idle' | 'optimizing' | 'reviewing'>('idle');
  const preReviewHtmlRef = useRef<string>(''); // snapshot for AO-8 cancel/restore
  const optimizeMetaRef = useRef<{ changedCount: number; creditDeducted: boolean }>({ changedCount: 0, creditDeducted: false });
  const [pendingImageCount, setPendingImageCount] = useState(0);
  const [surfyAiActive, setSurfyAiActive] = useState(false);
  const [linksAiActive, setLinksAiActive] = useState(false);
  const [aiVisibilitySummary, setAiVisibilitySummary] = useState<AiVisibilitySummary | null>(null);
  const [isRunningAiVisibility, setIsRunningAiVisibility] = useState(false);
  const [articleKeywords, setArticleKeywords] = useState<string[]>([]);
  const [breadcrumbKeywords, setBreadcrumbKeywords] = useState<string[]>([]);
  // The amber glow fires for Auto-Optimize ONLY — not while Surfy is thinking/replying.
  const isAiActive = isAutoOptimizing;

  const [editorHtml, setEditorHtml] = useState('');
  const [plainText, setPlainText] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [editorHeadings, setEditorHeadings] = useState<HeadingItem[]>([]);
  const [headingCount, setHeadingCount] = useState(0);
  const [paragraphCount, setParagraphCount] = useState(0);
  const [featuredImage, setFeaturedImage] = useState<{ url: string; alt: string } | null>(null);
  const [internalArticles, setInternalArticles] = useState<Array<{ id: number; title: string; url: string }>>([]);
  const [scoreData, setScoreData] = useState<ScoreData>({
    terms: [],
    words_target: 2000,
    words_min: 1500,
    words_max: 2500,
    headings_target: 15,
    headings_min: 10,
    headings_max: 20,
  });

  // Article keywords — one shared/deduped fetch feeds both the breadcrumb info
  // popover and the internal-links panel.
  const { data: keywordRows } = useArticleKeywords(id);
  useEffect(() => {
    if (!keywordRows) return;
    setArticleKeywords(keywordRows.map((k) => k.keyword));
    setBreadcrumbKeywords(keywordRows.map((k) => k.keyword).filter(Boolean));
  }, [keywordRows]);

  // Comment count for the toolbar badge (shared comments left via the share link).
  useEffect(() => {
    if (!id) return;
    fetch(`/api/articles/${id}/comments`)
      .then(r => r.json())
      .then(d => setCommentThreads(d.threads || []))
      .catch(() => {});
  }, [id, commentsVersion]);

  // Owner watches the same channel so reviewer comments appear live in the editor.
  const { channel: ownerChannel } = useArticleChannel({ articleId: article?.id ?? null });
  useEffect(() => {
    if (!ownerChannel) return undefined;
    const onComment = () => setCommentsVersion((v) => v + 1);
    ownerChannel.subscribe(ABLY_EVENTS.comment, onComment);
    ownerChannel.presence.enter({ role: 'owner' }).catch(() => {});
    return () => { ownerChannel.unsubscribe(ABLY_EVENTS.comment, onComment); };
  }, [ownerChannel]);

  const [reviewers, setReviewers] = useState<string[]>([]);
  useEffect(() => {
    if (!ownerChannel) return undefined;
    const refresh = () => ownerChannel.presence.get()
      .then((members) => setReviewers(members
        .filter((m) => (m.data as { role?: string } | undefined)?.role === 'viewer')
        .map((m) => ((m.data as { name?: string } | undefined)?.name) || 'Guest')))
      .catch(() => {});
    ownerChannel.presence.subscribe(['enter', 'leave', 'update'], refresh);
    refresh();
    return () => { ownerChannel.presence.unsubscribe(); };
  }, [ownerChannel]);

  // Live broadcast to viewers. Ably caps a single message at ~64KB; above this we
  // signal a refetch instead of shipping the whole document inline.
  const MAX_LIVE_HTML = 56 * 1024;
  const ownerChannelRef = useRef<typeof ownerChannel>(null);
  useEffect(() => { ownerChannelRef.current = ownerChannel; }, [ownerChannel]);

  // Monotonic revision: bumped on every content change; caret events carry the rev
  // of the doc they were measured against so the viewer never draws a stale caret.
  const contentRevRef = useRef(0);

  const publishContentRef = useRef(
    throttle((html: string, rev: number) => {
      const ch = ownerChannelRef.current;
      if (!ch) return;
      if (html.length > MAX_LIVE_HTML) void ch.publish(ABLY_EVENTS.content, { tooLarge: true, rev });
      else void ch.publish(ABLY_EVENTS.content, { html, rev });
    }, 500),
  );

  // Caret is throttled tighter than content (tiny payload, wants to feel smooth).
  const publishCaretRef = useRef(
    throttle((from: number, to: number, rev: number) => {
      const ch = ownerChannelRef.current;
      if (ch) void ch.publish(ABLY_EVENTS.caret, { from, to, rev });
    }, 75),
  );

  // Listen for Pixabay open events dispatched from TipTap image node toolbar
  useEffect(() => {
    const handler = (e: Event) => {
      const { onSelect } = (e as CustomEvent).detail as { onSelect: (img: { url: string; alt: string }) => void };
      pixabayCallbackRef.current = onSelect;
      setShowPixabay(true);
    };
    window.addEventListener('surfer:open-pixabay', handler);
    return () => window.removeEventListener('surfer:open-pixabay', handler);
  }, []);

  // The Content Editor must scroll INTERNALLY (fixed dark shell + scrollable
  // body) at ALL widths, not just desktop. Opt <html> into the editor
  // height-chain while this page is mounted; cleanup restores normal page
  // scrolling for every other route.
  useEffect(() => {
    document.documentElement.classList.add('editor-route');
    return () => document.documentElement.classList.remove('editor-route');
  }, []);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    fetch(`/api/articles/${id}`)
      .then((r) => r.json())
      .then((data) => {
        // Unfinished New-Content wizard (draft has saved state, no body yet) → resume.
        if (data.article?.wizard_state && !(data.article.content || '').trim()) {
          try {
            const ws = JSON.parse(data.article.wizard_state);
            const step = ['content-type', 'context', 'writing-mode'].includes(ws.step) ? ws.step : 'content-type';
            router.replace(`/articles/${step}?articleId=${id}`);
            return;
          } catch { /* fall through to the normal editor */ }
        }
        if (data.article) {
          const art = data.article;
          setArticle(art);
          // Rewrite image URLs so broken hotlinked images load via our server-side proxy.
          // Root-relative paths like /banner.png can't be fixed (domain unknown) — strip them.
          const content = (art.content || '').replace(
            /<img([^>]*)\ssrc="([^"]+)"([^>]*)>/gi,
            (_: string, before: string, src: string, after: string) => {
              if (src.startsWith('/api/image-proxy')) return `<img${before} src="${src}"${after}>`;
              if (src.startsWith('http://') || src.startsWith('https://')) {
                return `<img${before} src="/api/image-proxy?url=${encodeURIComponent(src)}"${after}>`;
              }
              // Root-relative or relative paths — can't proxy without original domain, remove tag
              return '';
            },
          );
          setEditorHtml(content);
          if (art.featured_image) {
            setFeaturedImage({ url: art.featured_image, alt: art.title || '' });
          }
          if (art.score_data) {
            try { setScoreData(JSON.parse(art.score_data)); } catch {}
          }
          if (art.ai_visibility_summary) {
            setAiVisibilitySummary(art.ai_visibility_summary);
          }
          // Restore internal links panel state from DB into localStorage (if localStorage is empty)
          if (art.internal_links_cache) {
            try {
              const lsKey = `internal-links-${art.id}`;
              if (!localStorage.getItem(lsKey)) {
                localStorage.setItem(lsKey, typeof art.internal_links_cache === 'string'
                  ? art.internal_links_cache
                  : JSON.stringify(art.internal_links_cache));
              }
            } catch { /* ignore */ }
          }
          // Fetch other articles in the same domain for internal linking
          if (art.domain_id) {
            Promise.all([
              fetch(`/api/domains`).then((r) => r.json()),
              fetch(`/api/articles?domainId=${art.domain_id}`).then((r) => r.json()),
            ])
              .then(([dd, d]) => {
                const dom = (dd.domains || []).find((d: any) => d.ID === art.domain_id);
                if (dom?.domain) setDomainBaseUrl(`https://${dom.domain}`);
                const others = (d.articles || [])
                  .filter((a: any) => a.id !== art.id && a.status === 'published')
                  .map((a: any) => ({ id: a.id, title: a.title, url: a.meta_url || '' }));
                setInternalArticles(others);
              })
              .catch(() => {});
          }
        }
      }
      )
      .catch(() => toast.error('Failed to load article'))
      .finally(() => setIsLoading(false));
  }, [id]);

  useEffect(() => {
    if (!actionsMenu && !voiceOpen && !shareOpen) return undefined;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (voiceOpen && voiceRef.current && !voiceRef.current.contains(t)) setVoiceOpen(false);
      if (shareOpen && shareRef.current && !shareRef.current.contains(t)) setShareOpen(false);
      if (actionsMenu && actionsRef.current && !actionsRef.current.contains(t)) { setActionsMenu(false); setVoiceOpen(false); }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [actionsMenu, voiceOpen, shareOpen]);

  const handleEditorChange = useCallback(
    (html: string, text: string, words: number, headings: number, paragraphs: number) => {
      setEditorHtml(html);
      setPlainText(text);
      setWordCount(words);
      setHeadingCount(headings);
      setParagraphCount(paragraphs);
      contentRevRef.current += 1; // new doc revision
      publishContentRef.current(html, contentRevRef.current); // live mirror (throttled, best-effort)
    },
    [],
  );

  // Publish caret position on every selection change.
  // The editor mounts asynchronously (dynamic import), so poll until it exists.
  useEffect(() => {
    let ed: ReturnType<NonNullable<typeof editorRef.current>['getEditor']> | null = null;
    const onSel = () => {
      if (!ed) return;
      const { from, to } = ed.state.selection;
      publishCaretRef.current(from, to, contentRevRef.current);
    };
    const tryBind = () => {
      const e = editorRef.current?.getEditor?.();
      if (e && !ed) { ed = e; e.on('selectionUpdate', onSel); return true; }
      return false;
    };
    if (!tryBind()) {
      const iv = setInterval(() => { if (tryBind()) clearInterval(iv); }, 200);
      return () => { clearInterval(iv); if (ed) ed.off('selectionUpdate', onSel); };
    }
    return () => { if (ed) ed.off('selectionUpdate', onSel); };
  }, [article?.id]);

  const handleMetaTitleChange = useCallback((v: string) => {
    setArticle((prev) => prev ? { ...prev, meta_title: v } : prev);
  }, []);

  const handleMetaDescriptionChange = useCallback((v: string) => {
    setArticle((prev) => prev ? { ...prev, meta_description: v } : prev);
  }, []);

  // The parent re-renders on every editor keystroke (setEditorHtml). Memoize the per-render work
  // that fed ContentScorePanel — a full-HTML regex and two JSON.parse of cached blobs — so it only
  // recomputes when its actual input changes (was running on every keystroke).
  const internalLinksCount = useMemo(() => (editorHtml.match(/<a\s[^>]*href=/gi) || []).length, [editorHtml]);
  const initialPlagiarism = useMemo(() => {
    try { const v = (article as any)?.plagiarism_json; return v ? JSON.parse(v) : null; } catch { return null; }
  }, [(article as any)?.plagiarism_json]);
  const initialAiReadability = useMemo(() => {
    try { const v = (article as any)?.ai_readability_json; return v ? JSON.parse(v) : null; } catch { return null; }
  }, [(article as any)?.ai_readability_json]);

  const handleRestoreVersion = (version: { id: number; content: string; score_data: string | null }) => {
    const editor = editorRef.current?.getEditor();
    // emitUpdate:true → fires onUpdate → handleEditorChange → autosave persists the restored content.
    if (editor) editor.commands.setContent(version.content, { emitUpdate: true });
    if (version.score_data) {
      try {
        const sd = JSON.parse(version.score_data);
        setScoreData(sd);
        setArticle((prev) => prev ? { ...prev, score_data: version.score_data ?? prev.score_data } : prev);
      } catch { /* ignore */ }
    }
    setShowHistory(false);
    toast.success('Version restored');
  };

  // ── Shared persistence used by both auto-save and programmatic saves ──
  // keepalive is opt-in: it lets a request survive page teardown (tab-hide / unload / nav) but caps
  // the body at ~64KB. Normal autosaves MUST NOT use it — a long article exceeds 64KB and the
  // browser would silently drop every save. Only the unload flush passes keepalive (small delta).
  const doSave = async (versionType?: string, opts?: { keepalive?: boolean }) => {
    if (!id) return false;
    // Update current_count for each term + store computed score so list view stays in sync
    const updatedTerms = scoreData.terms.map((t) => ({
      ...t,
      current_count: countOccurrences(plainText, t.term),
    }));
    const updatedScoreData: ScoreData & { _heading_count?: number; _paragraph_count?: number; _computed_score?: number } = {
      ...scoreData,
      terms: updatedTerms,
      _heading_count: headingCount,
      _paragraph_count: paragraphCount,
      _computed_score: computeContentScore(
        plainText, wordCount, headingCount,
        { ...scoreData, terms: updatedTerms },
        paragraphCount,
        (editorHtml.match(/<a\s[^>]*href=/gi) || []).length,
        editorHtml,
        article?.target_keyword || '',
      ),
    };

    // Persist internal links panel state from localStorage
    let internalLinksCache: object | undefined;
    try {
      const raw = localStorage.getItem(`internal-links-${id}`);
      if (raw) internalLinksCache = JSON.parse(raw);
    } catch { /* ignore */ }

    const res = await fetch(`/api/articles/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      ...(opts?.keepalive ? { keepalive: true } : {}), // only on unload (best-effort, <64KB body cap)
      body: JSON.stringify({
        content: editorHtml,
        word_count: wordCount,
        score_data: updatedScoreData,
        featured_image: featuredImage?.url ?? null,
        target_keyword: article?.target_keyword,
        meta_title: article?.meta_title,
        meta_description: article?.meta_description,
        meta_url: article?.meta_url,
        ...(versionType ? { version_type: versionType } : {}),
        ...(internalLinksCache ? { internal_links_cache: internalLinksCache } : {}),
      }),
    });
    if (!res.ok) throw new Error('Save failed');
    return true;
  };

  // ── Auto-save: persist silently after edits settle. A version snapshot is
  // created at most once every 2 min of editing so Version History stays useful
  // without flooding it on every keystroke. ──
  const autoSave = async (sig: string, opts?: { unload?: boolean }) => {
    // Never run two saves at once. If one is already in flight, skip — the finally-block below
    // re-checks for newer edits (flushRef) once it finishes, so nothing typed mid-save is lost.
    if (savingRef.current) return;
    savingRef.current = true;
    let ok = false;
    try {
      setAutoSaveState('saving');
      const wantVersion = Date.now() - lastVersionAt.current > 120000;
      await doSave(wantVersion ? 'manual_save' : undefined, { keepalive: opts?.unload });
      if (wantVersion) lastVersionAt.current = Date.now();
      lastSavedSig.current = sig;
      setAutoSaveState('saved');
      ok = true;
    } catch {
      setAutoSaveState('unsaved');
      // Self-heal transient blips: retry shortly instead of waiting for the next edit.
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(() => { void autoSave(sig); }, 3000);
    } finally {
      savingRef.current = false;
    }
    // Coalesce ONLY on success: persist anything edited while this save ran (flushRef reads the
    // latest state). On failure the 3s retry handles it — re-flushing here would tight-loop.
    if (ok) flushRef.current?.();
  };

  // Debounced auto-save: fires ~1s after the last edit to content / meta / image.
  useEffect(() => {
    if (isLoading || !article) return undefined;
    const sig = JSON.stringify({
      h: editorHtml,
      t: article.meta_title ?? '',
      d: article.meta_description ?? '',
      k: article.target_keyword ?? '',
      u: article.meta_url ?? '',
      img: featuredImage?.url ?? null,
    });
    // Record the loaded state as the baseline without saving it.
    if (lastSavedSig.current === null) { lastSavedSig.current = sig; return undefined; }
    if (sig === lastSavedSig.current || isAutoOptimizing) return undefined;
    setAutoSaveState('unsaved');
    if (autoTimer.current) clearTimeout(autoTimer.current);
    autoTimer.current = setTimeout(() => { void autoSave(sig); }, 800);
    return () => { if (autoTimer.current) clearTimeout(autoTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorHtml, featuredImage, article?.meta_title, article?.meta_description, article?.target_keyword, article?.meta_url, isLoading, isAutoOptimizing]);

  // Always-fresh "save the latest state if it's dirty" — used by the flush triggers below.
  // unload=true → the page is going away, so the PUT must outlive it (keepalive).
  flushRef.current = (unload?: boolean) => {
    if (isLoading || !article || isAutoOptimizing) return;
    const sig = JSON.stringify({
      h: editorHtml,
      t: article.meta_title ?? '',
      d: article.meta_description ?? '',
      k: article.target_keyword ?? '',
      u: article.meta_url ?? '',
      img: featuredImage?.url ?? null,
    });
    if (lastSavedSig.current === null || sig === lastSavedSig.current) return;
    if (autoTimer.current) clearTimeout(autoTimer.current);
    void autoSave(sig, { unload });
  };

  // Flush pending edits immediately on tab-hide / close, in-app navigation, and Cmd/Ctrl+S —
  // so changes are never lost to the debounce window (the main gap vs. Surfer-style autosave).
  useEffect(() => {
    // Page-teardown flushes (tab-hide / close / in-app nav) need keepalive so the PUT survives;
    // Cmd/Ctrl+S is a manual save while the page stays, so it uses a normal (uncapped) request.
    const flushUnload = () => flushRef.current?.(true);
    const onVis = () => { if (document.visibilityState === 'hidden') flushUnload(); };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); flushRef.current?.(); }
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('beforeunload', flushUnload);
    window.addEventListener('keydown', onKey);
    router.events.on('routeChangeStart', flushUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('beforeunload', flushUnload);
      window.removeEventListener('keydown', onKey);
      router.events.off('routeChangeStart', flushUnload);
    };
  }, [router.events]);

  const handleAcceptReject = async (action: 'accept' | 'reject') => {
    if (!id) return;
    try {
      const res = await fetch('/api/articles/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: id, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setArticle((prev) => prev ? { ...prev, status: data.status } : prev);
      toast.success(action === 'accept' ? 'Article accepted' : 'Article rejected');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleRunAiVisibility = async () => {
    if (!id) return;
    setIsRunningAiVisibility(true);
    try {
      const res = await fetch('/api/articles/ai-visibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI visibility check failed');
      setAiVisibilitySummary(data.summary);
      toast.success('AI Search checked');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsRunningAiVisibility(false);
    }
  };

  // "Apply All" from the AI Readability panel — send the suggestions to the sidecar, which
  // rewrites the article HTML applying them (structure only), then show the review bar.
  const handleApplyReadability = async (result: { criteria?: Array<{ suggestions?: string[] }> }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const editor = (editorRef.current as any)?.getEditor?.();
    if (!editor || !id || isApplyingReadability) return;
    const suggestions = (result?.criteria || []).flatMap((c) => c.suggestions || []).filter(Boolean);
    if (!suggestions.length) return;
    const preHtml = editor.getHTML();
    setIsApplyingReadability(true);
    try {
      const res = await fetch('/api/articles/apply-readability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: id, content: preHtml, suggestions }),
      });
      const data = await res.json();
      if (!res.ok || !data?.content) throw new Error(data?.error || 'Could not apply suggestions');
      if (data.warning) { toast(data.warning, { icon: '⚠️' }); return; } // content unchanged → no review bar
      try { editor.commands.setContent(data.content); } catch { /* noop */ }
      setReadabilityBar({ preHtml });
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Could not apply suggestions');
    } finally {
      setIsApplyingReadability(false);
    }
  };

  // Open the side-by-side diff of a pre-optimize snapshot vs. the current editor content.
  const openCompareVersions = (preHtml: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const editor = (editorRef.current as any)?.getEditor?.();
    setCompareVersions({ original: preHtml, updated: editor ? editor.getHTML() : '' });
  };
  // Shared "Compare versions" button for the Auto-Optimize and Optimize-AI-Readability bars.
  const compareVersionsButton = (preHtml: string) => (
    <button
      type="button"
      onClick={() => openCompareVersions(preHtml)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#fff', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-family-primary)', padding: '6px 8px', borderRadius: 6, transition: 'color 0.15s' }}
      onMouseEnter={(e) => { e.currentTarget.style.color = '#a1a1aa'; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = '#fff'; }}
    >
      <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9" /></svg>
      Compare versions
    </button>
  );

  const handleInsertLinks = (links: Array<{ anchorText: string; url: string }>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const editor = (editorRef.current as any)?.getEditor?.();
    if (!editor) return [];

    const preLinkHtml = editor.getHTML();
    const positions: number[] = [];

    // Build a flat text map: full concatenated text + offset→docPos mapping
    // This handles anchor text that spans ProseMirror node boundaries
    const buildTextMap = () => {
      let fullText = '';
      const segments: Array<{ textStart: number; docPos: number; len: number }> = [];
      editor.state.doc.descendants((node: any, pos: number) => {
        if (node.isText && node.text) {
          segments.push({ textStart: fullText.length, docPos: pos, len: node.text.length });
          fullText += node.text;
        }
      });
      return { fullText, segments };
    };

    const findInDoc = (anchorText: string): { from: number; to: number } | null => {
      const { fullText, segments } = buildTextMap();

      // Map a flat text-string offset back to a ProseMirror doc position
      const textToDoc = (textIdx: number): number => {
        for (const seg of segments) {
          if (seg.textStart <= textIdx && textIdx < seg.textStart + seg.len) {
            return seg.docPos + (textIdx - seg.textStart);
          }
        }
        return -1;
      };

      // 1) exact match
      let textIdx = fullText.indexOf(anchorText);
      if (textIdx !== -1) {
        const from = textToDoc(textIdx);
        if (from !== -1) return { from, to: from + anchorText.length };
      }

      // 2) case-insensitive
      textIdx = fullText.toLowerCase().indexOf(anchorText.toLowerCase());
      if (textIdx !== -1) {
        const from = textToDoc(textIdx);
        if (from !== -1) return { from, to: from + anchorText.length };
      }

      // 3) Normalise dashes, NBSP and multi-whitespace, lowercase — using a per-character
      //    parallel array so we can map normalised positions back to original offsets.
      const normCh = (ch: string) =>
        ch.replace(/[–—‐‑‒―]/g, '-')
          .replace(/[\s ]+/g, ' ')
          .toLowerCase();

      const buildNormMap = (src: string) => {
        const offsets: number[] = [];
        const buf: string[] = [];
        for (let i = 0; i < src.length; i++) {
          const n = normCh(src[i]);
          for (let j = 0; j < n.length; j++) {
            offsets.push(i);
            buf.push(n[j]);
          }
        }
        return { normStr: buf.join(''), offsets };
      };

      const { normStr: normFull, offsets: origOffsets } = buildNormMap(fullText);
      const normAnchor = normCh(anchorText).trim();

      const applyNormMatch = (nIdx: number, nLen: number): { from: number; to: number } | null => {
        if (nIdx === -1 || nIdx + nLen - 1 >= origOffsets.length) return null;
        const origStart = origOffsets[nIdx];
        const origEnd = origOffsets[nIdx + nLen - 1] + 1;
        const from = textToDoc(origStart);
        return from !== -1 ? { from, to: from + (origEnd - origStart) } : null;
      };

      // pass 3: full normalised anchor
      const p3 = applyNormMatch(normFull.indexOf(normAnchor), normAnchor.length);
      if (p3) return p3;

      // pass 4: longest contiguous word-window of anchor that appears in normFull
      //   try n-1 words from start, then n-1 words from end, then progressively shorter
      const words = normAnchor.split(/\s+/).filter(Boolean);
      if (words.length >= 3) {
        for (let size = words.length - 1; size >= Math.max(3, Math.ceil(words.length * 0.6)); size--) {
          for (let start = 0; start <= words.length - size; start++) {
            const sub = words.slice(start, start + size).join(' ');
            const subIdx = normFull.indexOf(sub);
            const r = applyNormMatch(subIdx, sub.length);
            if (r) return r;
          }
        }
      }

      return null;
    };

    // Deduplicate by URL — keep only the first suggestion per URL
    const seenUrls = new Set<string>();
    const dedupedLinks = links.filter(({ url }) => {
      if (seenUrls.has(url)) return false;
      seenUrls.add(url);
      return true;
    });

    const results = dedupedLinks.map(({ anchorText, url }) => {
      const href = url.startsWith('http') ? url : `${domainBaseUrl}/${url.replace(/^\//, '')}`;
      const range = findInDoc(anchorText);
      if (range) {
        // Skip headings — never insert links inside h1-h6
        const resolvedPos = editor.state.doc.resolve(range.from);
        if (resolvedPos.parent?.type?.name === 'heading') {
          return { url, anchorText, success: false as const };
        }
        editor.chain().setTextSelection(range).setLink({ href, target: '_blank' }).run();
        positions.push(range.from);
        return { url, anchorText, success: true as const };
      }
      return { url, anchorText, success: false as const };
    });

    const inserted = results.filter((r) => r.success).length;
    setLinkBar({ count: inserted, preLinkHtml, positions });
    setLinkNavIdx(0);
    return results;
  };

  // Generates images for placeholders inserted by auto-optimize, replacing them in the editor
  const generatePendingImages = async (
    pendingImages: Array<{ idx: number; prompt: string }>,
    keyword: string,
  ) => {
    if (!pendingImages.length) return;
    setPendingImageCount(pendingImages.length);

    // Process sequentially — Pollinations free tier allows only 1 concurrent request per IP
    for (const { idx, prompt } of pendingImages) {
      try {
        const res = await fetch('/api/articles/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword, title: prompt }),
        });
        const data = await res.json();
        if (!res.ok || !data.url) {
          setPendingImageCount((c) => Math.max(0, c - 1));
          continue;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ed = (editorRef.current as any)?.getEditor?.();
        if (!ed) {
          setPendingImageCount((c) => Math.max(0, c - 1));
          continue;
        }
        const currentHtml = ed.getHTML();
        const marker = `__AIMG_${idx}__`;
        // Two-pass: first find the img tag by title marker (works regardless of attr order),
        // then replace only its src attribute.
        let replaced = false;
        const newHtml = currentHtml.replace(
          new RegExp(`<img\\b[^>]*\\btitle="${marker}"[^>]*>`, 'gi'),
          (fullMatch: string) => {
            replaced = true;
            return fullMatch.replace(/\bsrc="[^"]*"/i, `src="${data.url}"`);
          },
        );
        if (replaced) {
          ed.commands.setContent(newHtml, false);
        }
      } catch (e) {
        console.error(`[auto-optimize] image generation failed for idx ${idx}:`, e);
      } finally {
        setPendingImageCount((c) => Math.max(0, c - 1));
      }
    }
  };

  const handleAutoOptimize = async (fromHtml?: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const editor = (editorRef.current as any)?.getEditor?.();
    if (!editor) return;
    const preHtml = fromHtml ?? editor.getHTML();
    setIsAutoOptimizing(true);
    setAutoOptimizeStatus('Starting…');
    try {
      const preText = preHtml.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
      const preParaCount = preText.split(/\n\n+/).filter((p: string) => p.trim().length > 0).length;
      const preScore = scoreData
        ? computeContentScore(preText, wordCount, headingCount, scoreData, preParaCount, (preHtml.match(/<a\s[^>]*href=/gi) || []).length, preHtml, article?.target_keyword || '')
        : 0;

      if (!fromHtml && id) {
        await fetch(`/api/articles/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: preHtml,
            word_count: wordCount,
            // Stamp the snapshot's score so it shows a gauge in Version History.
            score_data: { ...scoreData, _computed_score: preScore },
            version_type: 'pre_auto_optimize',
          }),
        }).catch(() => {});
      }
      // Current score gaps ("What's missing") — so a repeat run targets exactly what's still short.
      const scoreGaps = scoreData
        ? computeContentScoreBreakdown(preText, wordCount, headingCount, scoreData, preParaCount, preHtml, article?.target_keyword)
          .slots
          .filter((s) => s.missingPoints > 0)
          .sort((a, b) => b.missingPoints - a.missingPoints)
          .map((s) => ({ label: s.label, points: s.missingPoints, hint: s.hint }))
        : [];

      const res = await fetch('/api/articles/auto-optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: preHtml,
          scoreData,
          keyword: article?.target_keyword,
          articleId: article?.id,
          brandVoice: domains.find((d) => d.ID === article?.domain_id)?.brand_voice ?? '',
          aiVisibilitySummary,
          articleTitle: article?.title || '',
          articleMetaDescription: article?.meta_description || '',
          gaps: scoreGaps,
        }),
      });
      // Org-wide budget exhausted (shared 5h pool, same as Surfy): show a clear message, not a generic fail.
      if (res.status === 429) {
        const ej = await res.json().catch(() => ({}));
        if (ej.error === 'org_limit') {
          const at = ej.resetsAt ? new Date(ej.resetsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
          toast.error(`Your organization reached its AI limit.${at ? ` Resets at ${at}.` : ''}`);
          setIsAutoOptimizing(false);
          return;
        }
      }
      if (!res.ok || !res.body) throw new Error('Auto-optimize request failed');

      // Read SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let eventCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages (separated by \n\n)
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          if (!part.trim()) continue;
          eventCount++;
          const eventLine = part.match(/^event: (\w+)/m);
          const dataLine = part.match(/^data: (.+)/ms); // added 's' flag so . matches newlines as fallback
          const eventType = eventLine?.[1] ?? 'message';
          if (!dataLine) continue;

          let payload: any;
          try { payload = JSON.parse(dataLine[1]); } catch (e) { console.error('[auto-optimize] JSON parse error for event', eventType, 'data preview:', dataLine[1].slice(0, 200), e); continue; }

          if (eventType === 'progress') {
            setAutoOptimizeStatus(payload.message ?? '');
          } else if (eventType === 'done') {
            setAutoOptimizeBar({ preHtml });
            setIsAutoOptimizing(false);
            // emitUpdate:true syncs the page's editorHtml baseline with the applied content (so later
            // edits + autosave build on the optimized version, not a stale snapshot).
            try { editor.commands.setContent(payload.content, { emitUpdate: true }); } catch (e) { console.error('[auto-optimize] setContent error:', e); }

            // Apply the analysis results FIRST — they ship in this `done` payload and the
            // panel (SEO entities + AI Search) should populate the instant optimize finishes.
            // Image generation below is sequential and slow; running it before these setState
            // calls made terms/AI-Search appear ~a minute late with no loading indicator.

            // Sync the FAQ questions the optimizer resolved (in the article's language) so the live
            // score credits the FAQ section.
            if (Array.isArray(payload.paaQuestions) && payload.paaQuestions.length) {
              setScoreData((prev) => ({ ...prev, paa_questions: payload.paaQuestions }));
            }

            // Apply the DataForSEO refresh: grown keyword list + re-checked AI Search coverage.
            if (Array.isArray(payload.updatedTerms) && payload.updatedTerms.length) {
              setScoreData((prev) => ({ ...prev, terms: payload.updatedTerms }));
            }
            if (payload.aiSummary) {
              setAiVisibilitySummary(payload.aiSummary);
            }

            // Freshly scraped competitor outlines → fill the Competitors panel immediately.
            if (Array.isArray(payload.competitorOutlines) && payload.competitorOutlines.length) {
              setArticle((prev) => (prev ? { ...prev, competitor_outlines_cache: JSON.stringify({ competitors: payload.competitorOutlines }) } : prev));
            }

            // Apply meta suggestions
            if (payload.suggestedMetaTitle) handleMetaTitleChange(payload.suggestedMetaTitle);
            if (payload.suggestedMetaDescription) handleMetaDescriptionChange(payload.suggestedMetaDescription);

            // Score display
            if (typeof payload.postScore === 'number') {
              const delta = payload.scoreDelta as number;
              const sign = delta > 0 ? '+' : '';
              const icon = delta > 0 ? '▲' : delta < 0 ? '▼' : '—';
              const target = payload.postScore >= 90 ? ' HIT 90+' : payload.attempts > 1 ? ` after ${payload.attempts} attempts` : '';
              setAutoOptimizeStatus(
                `Score: ${payload.postScore}/100 (${icon}${sign}${delta})${target}`
              );
            }

            // Now fill image placeholders with real images (sequential → slow). This only
            // mutates the editor body, so the panel data above is already live.
            if (payload.pendingImages?.length && article?.target_keyword) {
              await generatePendingImages(payload.pendingImages, article.target_keyword);
              // Save final content with real image URLs to DB
              const finalHtml = editor.getHTML();
              const putId = article?.id || id;
              if (putId) {
                await fetch(`/api/articles/${putId}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ content: finalHtml }),
                }).catch(() => {});
              }
            }
            return;
          } else if (eventType === 'error') {
            throw new Error(payload.message || 'Auto-optimize failed');
          }
        }
      }
    } catch (err) {
      console.error('[auto-optimize] failed:', err);
      toast.error(getErrorMessage(err));
    } finally {
      setIsAutoOptimizing(false);
    }
  };

  // AO-7: section-by-section Auto-Optimize. Streams /api/articles/optimize-sections, collects
  // ordered section events, then loads a "review doc" where each CHANGED section becomes a
  // contentOptimizer node (Accept/Reject). isAutoOptimizing spans the whole flow so autosave +
  // the format toolbar stay suspended until every section is resolved (Step D) or we bail out.
  const handleAutoOptimizeSections = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const editor = (editorRef.current as any)?.getEditor?.();
    if (!editor) return;
    const preHtml: string = editor.getHTML();
    preReviewHtmlRef.current = preHtml;
    optimizeStore.clear();
    setOptimizeState('optimizing');
    setIsAutoOptimizing(true);
    setAutoOptimizeStatus('Optimizing sections…');

    const resetIdle = () => {
      optimizeStore.clear();
      setOptimizeState('idle');
      setIsAutoOptimizing(false);
    };

    try {
      const res = await fetch('/api/articles/optimize-sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: preHtml, articleId: article?.id, scoreData }),
      });
      // Org-wide AI budget exhausted — surface the same message the legacy flow uses, then bail.
      if (res.status === 429) {
        const ej = await res.json().catch(() => ({}));
        if (ej.error === 'org_limit') {
          const at = ej.resetsAt ? new Date(ej.resetsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
          toast.error(`Your organization reached its AI limit.${at ? ` Resets at ${at}.` : ''}`);
          resetIdle();
          return;
        }
      }
      if (!res.ok || !res.body) throw new Error('Optimize request failed');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const orderedEvents: SectionEvent[] = [];

      while (true) {
        // eslint-disable-next-line no-await-in-loop
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          if (!part.trim()) continue;
          const eventLine = part.match(/^event: (\w+)/m);
          const dataLine = part.match(/^data: (.+)/ms);
          const eventType = eventLine?.[1] ?? 'message';
          if (!dataLine) continue;

          let payload: unknown;
          try { payload = JSON.parse(dataLine[1]); } catch (e) { console.error('[optimize-sections] JSON parse error', eventType, e); continue; }

          if (eventType === 'section') {
            const ev = payload as SectionEvent;
            orderedEvents.push(ev);
            optimizeStore.set(ev.sectionId, { oldHtml: ev.oldHtml, newHtml: ev.newHtml, changed: ev.changed });
          } else if (eventType === 'done') {
            const meta = payload as { changedCount: number; total: number; promptVersion: string; creditDeducted: boolean };
            optimizeMetaRef.current = { changedCount: meta.changedCount, creditDeducted: meta.creditDeducted };
            if (meta.changedCount > 0) {
              const reviewHtml = buildReviewDoc(orderedEvents);
              // emitUpdate:false → entering review must NOT trigger autosave.
              try { editor.commands.setContent(reviewHtml, { emitUpdate: false }); } catch (e) { console.error('[optimize-sections] setContent error', e); }
              setOptimizeState('reviewing');
              setAutoOptimizeStatus(`Review ${meta.changedCount} section${meta.changedCount === 1 ? '' : 's'}…`);
            } else {
              // Already well-optimized — no changes, no credit. (Toast UI is AO-8.)
              setAutoOptimizeStatus('Already well-optimized — no changes needed.');
              resetIdle();
            }
            return;
          } else if (eventType === 'error') {
            throw new Error((payload as { message?: string })?.message || 'Optimize failed');
          }
        }
      }
      // Stream ended without a done event — treat as no-op.
      resetIdle();
    } catch (err) {
      console.error('[optimize-sections] failed:', err);
      toast.error(getErrorMessage(err));
      resetIdle();
    }
  };

  // AO-7 Step D: while reviewing, count remaining contentOptimizer nodes. When the user has
  // resolved (Accept/Reject) every section → none remain → return to idle and resume autosave,
  // which persists the now-clean document. The editor mounts asynchronously (dynamic import) and
  // can remount mid-review, so poll-bind the listener like the caret binder above — otherwise the
  // review could never complete and isAutoOptimizing would stay stuck true (autosave dead).
  useEffect(() => {
    if (optimizeState !== 'reviewing') return undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ed: any = null;
    const check = () => {
      if (!ed) return;
      let count = 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ed.state.doc.descendants((n: any) => { if (n.type.name === 'contentOptimizer') count += 1; });
      if (count === 0) {
        setEditorHtml(ed.getHTML()); // sync resolved content into page state BEFORE re-enabling autosave
        optimizeStore.clear();
        setOptimizeState('idle');
        setIsAutoOptimizing(false); // autosave resumes and persists the resolved content
      }
    };
    const tryBind = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = (editorRef.current as any)?.getEditor?.();
      if (e && !ed) { ed = e; e.on('update', check); check(); return true; }
      return false;
    };
    if (!tryBind()) {
      const iv = setInterval(() => { if (tryBind()) clearInterval(iv); }, 200);
      return () => { clearInterval(iv); if (ed) ed.off('update', check); };
    }
    return () => { if (ed) ed.off('update', check); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optimizeState]);

  const handlePixabaySelect = (image: { url: string; alt: string; width: number; height: number }) => {
    // If opened from image node toolbar, update that node's src; otherwise insert at cursor
    if (pixabayCallbackRef.current) {
      pixabayCallbackRef.current({ url: image.url, alt: image.alt });
      pixabayCallbackRef.current = null;
    } else {
      const editor = editorRef.current?.getEditor();
      if (!editor) return;
      editor.chain().focus().setImage({ src: image.url, alt: image.alt }).run();
    }
  };

  if (isLoading) {
    return (
      <AppShell
        domains={domains}
        showAddModal={() => {}}
        showSettings={() => {}}
        showSidebar={false}
        topbarTitle=""
        contentClassName="article-editor-shell"
        hideMobileNav
      >
        {/* Surfer-style loading screen inside the editor gray wrapper */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#f4f4f5', padding: 8, position: 'relative', overflow: 'hidden', borderRadius: 12 }}>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', background: '#fff', borderRadius: 12, border: '1px solid #e4e4e7', overflow: 'hidden' }}>
            <EditorLoading />
          </div>
        </div>
      </AppShell>
    );
  }

  if (!article) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f8f8f9', gap: 16 }}>
        <p style={{ color: '#9f9fa9' }}>Article not found.</p>
        <Link href="/articles"><a style={{ color: 'var(--color-surface-raised)' }}>← Back to list</a></Link>
      </div>
    );
  }

  const PANEL_W = 320;
  const PANEL_GAP = 4; // 0.25rem

  return (
    <AppShell
      domains={domains}
      showAddModal={() => setShowAddDomain(true)}
      showSettings={() => setShowSettings(true)}
      showSidebar={false}
      topbarTitle={article.target_keyword || article.title}
      breadcrumb={(
        <EditorBreadcrumb
          domain={domains.find((d) => d.ID === article.domain_id)?.domain || ''}
          title={article.target_keyword || article.title}
          keywords={breadcrumbKeywords.length ? breadcrumbKeywords : (article.target_keyword ? [article.target_keyword] : [])}
          language={article.language}
          createdAt={article.created_at}
          modifiedAt={article.updated_at}
        />
      )}
      contentClassName="article-editor-shell"
      hideMobileNav
    >
      <style>{`
        @keyframes barPulse {
          0%, 100% { transform: scaleY(0.5); opacity: 0.5; }
          50%       { transform: scaleY(1.4); opacity: 1; }
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Surfer-SEO-style image NodeView ──────────────────────── */
        [data-surfer-image] { margin: 0.5rem 0; }
        .surfer-image-group {
          display: flex; flex-direction: column; gap: 0.5rem;
          background: #fff; border-radius: 0.5rem; overflow: hidden;
          padding-bottom: 0.25rem;
          position: relative;
        }
        .ProseMirror-selectednode .surfer-image-group {
          outline: 2px solid #51A2FF; border-radius: 0.5rem;
        }
        .surfer-image-container {
          position: relative; overflow: hidden;
          transition: all 0.2s ease-in-out;
        }
        .group:hover .surfer-image-container { border-radius: 0; }
        .surfer-image-overlay {
          position: absolute; inset: 0; z-index: 4;
          background: #18181B; opacity: 0;
          display: flex; align-items: center; justify-content: center;
          transition: opacity 0.1s ease-in-out;
          border-radius: 0;
        }
        .group:hover .surfer-image-overlay {
          opacity: 0.24;
          border-bottom-right-radius: 0.75rem;
          border-bottom-left-radius: 0.75rem;
        }
        .surfer-image-img {
          display: block; width: 100%; height: auto; min-height: 100px;
          max-width: 100%; object-fit: cover; aspect-ratio: 16 / 9;
          transition: border-radius 0.2s ease-in-out;
        }
        .group:hover .surfer-image-img {
          border-bottom-right-radius: 0.75rem;
          border-bottom-left-radius: 0.75rem;
        }
        .surfer-image-toolbar {
          position: absolute; bottom: 0; z-index: 5; width: 100%;
          overflow: hidden; max-height: 0;
          transition: max-height 0.1s ease-in-out;
        }
        .group:hover .surfer-image-toolbar { max-height: 300px; }
        .surfer-toolbar-inner {
          display: flex; flex-direction: column; gap: 1px;
          background: #fff; border-radius: 0.5rem;
        }
        .surfer-toolbar-prompt-row {
          display: flex; align-items: flex-end; justify-content: space-between;
          min-height: 48px; padding: 0.5rem 0.75rem;
          background: #F4F4F5; border-radius: 0.5rem 0.5rem 0 0;
        }
        .surfer-toolbar-prompt-icon {
          display: flex; align-items: flex-end; justify-content: center;
          width: 21px; height: 100%; padding-bottom: 0.375rem;
          color: #3F3F47; flex-shrink: 0;
        }
        .surfer-toolbar-prompt-input {
          flex: 1; min-height: 28px; border: none; background: transparent;
          padding: 0.25rem 0; font-size: 0.875rem; line-height: 1.25rem;
          color: #18181B; resize: none; outline: none;
          font-family: var(--font-family-primary);
          box-shadow: none;
        }
        .surfer-toolbar-prompt-input::placeholder { color: #52525C; }
        .surfer-toolbar-send-btn {
          display: inline-flex; align-items: center; justify-content: center;
          padding: 0.375rem; border: none; border-radius: 0.375rem;
          background: #F4F4F5; color: #18181B; cursor: pointer;
          flex-shrink: 0; transition: background 0.15s;
        }
        .surfer-toolbar-send-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .surfer-toolbar-send-btn:not(:disabled):hover { background: #E4E4E7; }
        .surfer-toolbar-actions-row {
          display: flex; align-items: center; gap: 0.5rem;
          height: 48px; padding: 0.5rem 0.75rem;
          background: #F8F8F9; border-radius: 0 0 0.5rem 0.5rem;
        }
        .surfer-toolbar-actions-left {
          display: flex; align-items: center; gap: 0.5rem; flex: 1;
        }
        .surfer-toolbar-actions-right {
          display: flex; align-items: center; gap: 0.125rem;
        }
        .surfer-btn {
          display: inline-flex; align-items: center; justify-content: center;
          padding: 0.25rem 0.75rem; border: none; border-radius: 0.375rem;
          font-size: 0.8125rem; line-height: 1rem; font-weight: 600;
          font-family: var(--font-family-primary); cursor: pointer;
          transition: background 0.15s; white-space: nowrap;
        }
        .surfer-btn-ghost {
          background: #F4F4F5; color: #18181B;
        }
        .surfer-btn-ghost:hover { background: #E4E4E7; }
        .surfer-btn-ghost:active { background: #D4D4D8; }
        .surfer-toolbar-drag-text {
          font-size: 0.875rem; line-height: 1.25rem; color: #3F3F47;
          overflow: hidden; white-space: nowrap;
        }
        .surfer-btn-delete {
          display: inline-flex; align-items: center; justify-content: center;
          padding: 0.375rem; border: none; border-radius: 0;
          background: transparent; color: inherit; cursor: pointer;
          transition: opacity 0.15s;
        }
        .surfer-btn-delete:hover { opacity: 0.8; }
        .surfer-audio-bars { display: flex; gap: 0.125rem; }
        .surfer-audio-bar { width: 4px; height: 12px; background: #1AB25E; }
        /* ── Glow effect during AI image generation ─────────────── */
        @keyframes surferGlow {
          0%, 100% { box-shadow: 0 0 15px rgba(99, 13, 227, 0.3), 0 0 35px rgba(99, 13, 227, 0.15), 0 0 60px rgba(99, 13, 227, 0.08); }
          50%      { box-shadow: 0 0 25px rgba(99, 13, 227, 0.5), 0 0 55px rgba(99, 13, 227, 0.3), 0 0 90px rgba(99, 13, 227, 0.15); }
        }
        .surfer-image-generating .surfer-image-group::before {
          content: '';
          position: absolute;
          inset: -8px;
          z-index: -1;
          pointer-events: none;
          border-radius: 0.625rem;
          animation: surferGlow 1.5s ease-in-out infinite;
        }
        .surfer-image-generating.surfer-image-group {
          overflow: visible;
        }
        .surfer-alt-row {
          display: flex; align-items: center; height: 20px;
          padding-right: 0.5rem; gap: 0;
        }
        .surfer-alt-input {
          flex: 1; border: none; outline: none; padding-right: 0.75rem;
          font-size: 0.875rem; line-height: 1.25rem; color: #3F3F47;
          background: transparent; font-family: var(--font-family-primary);
        }
        .surfer-alt-input::placeholder { color: #52525C; }
        .surfer-alt-input:disabled { background: #fff; }
        .surfer-alt-clear-btn {
          display: inline-flex; align-items: center; justify-content: center;
          border: none; border-radius: 0; background: transparent;
          padding: 0; font-size: 0.875rem; line-height: 1.25rem;
          color: #3F3F47; cursor: pointer; font-family: var(--font-family-primary);
          font-weight: 600; visibility: hidden; white-space: nowrap;
          transition: color 0.15s;
        }
        .group:hover .surfer-alt-clear-btn { visibility: visible; }
        .surfer-alt-clear-btn:hover { color: #2F2F34; }
        .surfer-alt-clear-btn:active { color: #09090B; }
      `}</style>

      {/* ── Gray zone (bg-gray-5 equivalent) ──────────────────────── */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          background: '#f4f4f5',
          padding: 4,
          gap: 0,
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 0,
        }}
      >

        <Head>
          <title>{`${article.meta_title || article.title || 'Editor'} – SerpBear`}</title>
          {article.schema_json && (() => {
            try {
              const schema = JSON.parse(article.schema_json);
              return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema, null, 2) }} />;
            } catch { return null; }
          })()}
        </Head>

        {/* ── Main content row ─────────────────────────────────────── */}
        <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex' }}>

          {/* ── Auto-save status (floating, bottom-left) — only while saving/unsaved ── */}
          {autoSaveState !== 'saved' && (
          <div
            title={autoSaveState === 'saving' ? 'Saving…' : 'Unsaved changes'}
            style={{
              position: 'absolute', bottom: 12, left: 12, zIndex: 80,
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999,
              background: 'rgba(255,255,255,0.92)', border: '1px solid #ececef', boxShadow: '0 1px 3px rgba(24,26,34,0.08)',
              backdropFilter: 'blur(6px)', fontSize: 12, fontWeight: 500, color: '#71717a',
              fontFamily: 'var(--font-family-primary)', whiteSpace: 'nowrap', pointerEvents: 'none',
            }}
          >
            {autoSaveState === 'saving' ? (
              <div style={{ width: 13, height: 13, border: '2px solid #e4e4e7', borderTopColor: '#783afb', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
            ) : (
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
            )}
            {autoSaveState === 'saving' ? 'Saving…' : 'Unsaved'}
          </div>
          )}

          {/* ── Reviewer presence indicator (floating, bottom-right) ── */}
          {reviewers.length > 0 && (
          <div
            title={reviewers.join(', ')}
            style={{
              position: 'absolute', bottom: 12, right: 12, zIndex: 80,
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999,
              background: 'rgba(255,255,255,0.92)', border: '1px solid #ececef', boxShadow: '0 1px 3px rgba(24,26,34,0.08)',
              backdropFilter: 'blur(6px)', fontSize: 12, fontWeight: 500, color: '#52525c',
              fontFamily: 'var(--font-family-primary)', whiteSpace: 'nowrap', pointerEvents: 'none',
            }}
          >
            <span>👀 {reviewers.length} reviewing</span>
          </div>
          )}

          {/* ── Editor card (white rounded, padding-right for panel) ── */}
          <div
            className="ce-editor-card"
            style={{
              flex: 1,
              minWidth: 0,
              background: '#fff',
              borderRadius: 12,
              border: '1px solid #e4e4e7',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              // Reserve space for the right panel so editor content is never hidden behind it
              marginRight: panelCollapsed ? 0 : PANEL_W + PANEL_GAP,
              transition: 'margin-right 0.2s ease',
            }}
          >
            <ArticleEditor
              editorRef={editorRef}
              onSurfyOpenChange={setSurfyDockOpen}
              surfyDockEl={surfyDockEl}
              content={article.content || ''}
              keyword={article.target_keyword}
              metaTitle={article.meta_title}
              metaDescription={article.meta_description}
              scoreData={scoreData}
              internalArticles={internalArticles}
              reviewMode={!!linkBar}
              formattingSuspended={optimizeState === 'reviewing'}
              highlightTerms={highlightTerms}
              onAiActivity={setSurfyAiActive}
              articleKeyword={article?.target_keyword || ''}
              plagiarismSentences={plagSentences}
              plagiarismFocused={plagFocused}
              onChange={handleEditorChange}
              onMetaTitleChange={handleMetaTitleChange}
              onMetaDescriptionChange={handleMetaDescriptionChange}
              initialFeaturedImage={featuredImage}
              onFeaturedImageChange={setFeaturedImage}
              onHeadingsChange={setEditorHeadings}
              threads={commentThreads}
              commentAuthor={commentAuthor}
              commentArticleId={String(article.id)}
              onCommentsChanged={() => setCommentsVersion((v) => v + 1)}
              onCreateComment={async (quote, draft) => {
                // Optimistic: show a pending pin instantly, reconcile after the POST.
                const tmp = `tmp_${Math.random().toString(36).slice(2, 10)}`;
                setCommentThreads((prev) => [...prev, { id: tmp, parentId: null, quote, text: draft.text, images: draft.images, author: commentAuthor.name, color: commentAuthor.color, avatar: commentAuthor.avatar, resolved: false, reactions: {}, createdAt: Date.now(), updatedAt: null, replies: [], pending: true }]);
                try {
                  const r = await fetch(`/api/articles/${id}/comments`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ quote, text: draft.text, images: draft.images, author: commentAuthor.name, color: commentAuthor.color, avatar: commentAuthor.avatar || '' }),
                  });
                  const d = await r.json();
                  setCommentsVersion((v) => v + 1);
                  return d.comment?.id as string | undefined;
                } catch { setCommentThreads((prev) => prev.filter((t) => t.id !== tmp)); return undefined; }
              }}
            />
          </div>

          {/* ── Compact actions bar (shown when the side panel is hidden) ── */}
          <AnimatePresence>
          {panelCollapsed && (
            <motion.div
              key="collapsedbar"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, delay: 0.12 }}
              style={{
                position: 'absolute', top: 14, right: 12, zIndex: 95, display: 'flex', alignItems: 'center', gap: 6,
              }}>
              <div ref={actionsRef} style={{ position: 'relative', display: 'inline-flex' }}>
                <IconBtn onClick={() => { setActionsMenu((o) => !o); setVoiceOpen(false); }} title="More"><IcoDots /></IconBtn>
                {actionsMenu && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 200, minWidth: 244,
                    background: '#fff', borderRadius: 12, padding: '6px 0',
                    boxShadow: '0px 8px 24px rgba(24,26,34,0.16), 0px 2px 6px rgba(24,26,34,0.08)',
                    animation: 'growOut 0.18s cubic-bezier(0.16,1,0.3,1)',
                  }}>
                    <MenuRow
                      icon={article.status === 'accepted' ? <IcoDoneFilled /> : <IcoDoneOutline />}
                      label={article.status === 'accepted' ? 'Unmark as done' : 'Mark as done'}
                      onClick={() => { handleAcceptReject(article.status === 'accepted' ? 'reject' : 'accept'); setActionsMenu(false); }}
                    />
                    <MenuRow icon={<IcoClock />} label="Version history" onClick={() => { setPanelCollapsed(false); setShowInternalLinksPanel(false); setShowHistory(true); setActionsMenu(false); }} />
                    <MenuRow icon={<IcoGear />} label="Settings" onClick={() => { setShowCustomization(true); setActionsMenu(false); }} />
                    <div style={{ position: 'relative' }}>
                      <MenuRow icon={<IcoVoice />} label="Voice" sub="SERP based" chevron onClick={() => setVoiceOpen((v) => !v)} />
                      {voiceOpen && <VoicePopover style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 200 }} />}
                    </div>
                  </div>
                )}
              </div>
              <IconBtn onClick={() => setPanelCollapsed(false)} title="Show side panel"><IcoPanel /></IconBtn>
              <div ref={shareRef} style={{ position: 'relative', display: 'inline-flex' }}>
                <button
                  onClick={() => { setShareOpen((v) => !v); setVoiceOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 14px', borderRadius: 6,
                    border: 'none', background: shareOpen ? '#783afb' : '#18181b', color: '#fff', fontSize: 13, fontWeight: 600,
                    fontFamily: 'var(--font-family-primary)', cursor: 'pointer', flexShrink: 0, transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#783afb'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = shareOpen ? '#783afb' : '#18181b'; }}
                >Share</button>
                {shareOpen && <SharePopover articleId={String(id)} onClose={() => setShareOpen(false)} style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 200 }} />}
              </div>
            </motion.div>
          )}
          </AnimatePresence>

          {/* ── Right panel (absolute, two cards stacked) ─────────── */}
          <AnimatePresence>
          {!panelCollapsed && (
          <motion.div
            key="rightpanel"
            className="ce-right-panel"
            initial={{ x: PANEL_W + 24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: PANEL_W + 24, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 40, mass: 0.9 }}
            style={{
              position: 'absolute',
              top: 0, right: 0, bottom: 0,
              width: PANEL_W,
              display: 'flex',
              flexDirection: 'column',
              gap: PANEL_GAP,
              zIndex: 90,
            }}
          >
            {/* Top card: action icons + share */}
            <div
              style={{
                background: '#fff',
                border: '1px solid #e4e4e7',
                borderRadius: 12,
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
              }}
            >
              {/* Left: action icon buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {/* Mark / unmark as done */}
                <span data-tour="done" style={{ display: 'inline-flex' }}>
                  <IconBtn
                    onClick={() => handleAcceptReject(article.status === 'accepted' ? 'reject' : 'accept')}
                    title={article.status === 'accepted' ? 'Unmark as done' : 'Mark as done'}
                  >
                    <span style={{ color: article.status === 'accepted' ? '#18181b' : '#3f3f47', display: 'inline-flex' }}>
                      {article.status === 'accepted' ? <IcoDoneFilled /> : <IcoDoneOutline />}
                    </span>
                  </IconBtn>
                </span>

                {/* Version History */}
                <span data-tour="version" style={{ display: 'inline-flex' }}>
                  <IconBtn onClick={() => { setShowInternalLinksPanel(false); setShowHistory((v) => !v); }} title="Version History">
                    <IcoClock />
                  </IconBtn>
                </span>

                {/* Voice */}
                <div ref={voiceRef} data-tour="voice" style={{ position: 'relative', display: 'inline-flex' }}>
                  <IconBtn onClick={() => setVoiceOpen((v) => !v)} title="Voice">
                    <IcoVoice />
                  </IconBtn>
                  {voiceOpen && <VoicePopover style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 200 }} />}
                </div>

                {/* Settings (customization panel) */}
                <span data-tour="settings" style={{ display: 'inline-flex' }}>
                  <IconBtn onClick={() => setShowCustomization(true)} title="Settings"><IcoGear /></IconBtn>
                </span>
              </div>

              {/* Right: panel toggle + Share */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span data-tour="hide-panel" style={{ display: 'inline-flex' }}>
                  <IconBtn onClick={() => { setPanelCollapsed(true); setVoiceOpen(false); }} title="Hide side panel"><IcoPanel /></IconBtn>
                </span>
                <div ref={shareRef} style={{ position: 'relative', display: 'inline-flex' }}>
                  <button
                    data-tour="share"
                    onClick={() => { setShareOpen((v) => !v); setVoiceOpen(false); }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                      padding: '6px 14px', borderRadius: 6, border: 'none',
                      background: shareOpen ? '#783afb' : '#18181b', color: '#fff',
                      fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-family-primary)',
                      cursor: 'pointer', flexShrink: 0, transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#783afb'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = shareOpen ? '#783afb' : '#18181b'; }}
                  >
                    Share
                  </button>
                  {shareOpen && <SharePopover articleId={String(id)} onClose={() => setShareOpen(false)} style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 200 }} />}
                </div>
              </div>
            </div>

            {/* Bottom card: keyword + content score OR panel */}
            <div
              style={{
                background: '#fff',
                border: '1px solid #e4e4e7',
                borderRadius: 12,
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {surfyDockOpen ? (
                // Docked Surfy pane — the editor portals SurfyChatPanel into this element.
                <div ref={setSurfyDockEl} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }} />
              ) : showInternalLinksPanel ? (
                <InternalLinksPanel
                  articleId={article.id}
                  keyword={article.target_keyword || ''}
                  plainText={plainText}
                  domainBaseUrl={domainBaseUrl}
                  domains={domains}
                  onClose={() => setShowInternalLinksPanel(false)}
                  onInsertLinks={handleInsertLinks}
                  onAiActivity={setLinksAiActive}
                  articleKeywords={articleKeywords}
                  internalArticles={internalArticles}
                />
              ) : showHistory ? (
                <VersionHistoryPanel
                  articleId={article.id}
                  currentWordCount={wordCount}
                  currentScore={(scoreData as any)._computed_score ?? 0}
                  onClose={() => setShowHistory(false)}
                  onRestore={handleRestoreVersion}
                />
              ) : (
                <>
                  {/* ContentScorePanel fills remaining height */}
                  <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }} className="styled-scrollbar">
                    <ContentScorePanel
                      plainText={plainText}
                      wordCount={wordCount}
                      headingCount={headingCount}
                      scoreData={scoreData}
                      internalLinksCount={internalLinksCount}
                      html={editorHtml}
                      keyword={article?.target_keyword || ''}
                      onInternalLinks={() => { setShowHistory(false); setShowInternalLinksPanel(true); }}
                      onAutoOptimize={() => handleAutoOptimizeSections()}
                      isAutoOptimizing={isAutoOptimizing}
                      saveState={autoSaveState}
                      articleId={article.id}
                      cachedOutlines={article.competitor_outlines_cache}
                      fallbackScore={article.content_score}
                      title={article.title || ''}
                      metaTitle={article.meta_title || ''}
                      metaDescription={article.meta_description || ''}
                      onMetaTitleChange={handleMetaTitleChange}
                      onMetaDescriptionChange={handleMetaDescriptionChange}
                      highlightTerms={highlightTerms}
                      onHighlightTermsChange={setHighlightTerms}
                      initialPlagiarism={initialPlagiarism}
                      initialAiReadability={initialAiReadability}
                      featuredImage={featuredImage}
                      onFeaturedImageChange={setFeaturedImage}
                      isDone={article.status === 'accepted'}
                      onMarkDone={() => handleAcceptReject('accept')}
                      aiVisibilitySummary={aiVisibilitySummary}
                      isRunningAiVisibility={isRunningAiVisibility}
                      onRunAiVisibility={handleRunAiVisibility}
                      onApplyReadability={handleApplyReadability}
                      onPlagiarismHighlight={handlePlagiarismHighlight}
                      readabilityAccepted={readabilityAcceptKey}
                    />
                  </div>
                </>
              )}
            </div>
          </motion.div>
          )}
          </AnimatePresence>
        </div>

        {/* ── Auto-optimize loading indicator ──────────────────────── */}
        {isAutoOptimizing && (
          <div style={{
            position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
            zIndex: 10000, width: 520, maxWidth: 'calc(100vw - 40px)',
            background: '#09090b', borderRadius: 10,
            boxShadow: '0 8px 40px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.3)',
            display: 'flex', alignItems: 'center', padding: '0 16px', height: 52, gap: 12,
          }}>
            <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.15)', borderTopColor: '#783afb', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
            <span
              key={autoOptimizeStatus}
              style={{
                fontSize: 13, color: '#a1a1aa', fontFamily: 'var(--font-family-primary)',
                flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                animation: 'fadeSlideIn 0.25s ease',
              }}
            >
              {autoOptimizeStatus}
            </span>
            <div style={{ display: 'flex', gap: 3, alignItems: 'center', flexShrink: 0 }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ width: 3, borderRadius: 2, background: '#783afb', animation: `barPulse 1s ease-in-out ${i * 0.15}s infinite`, height: 14 }} />
              ))}
            </div>
          </div>
        )}

        {/* ── Auto-optimize result bar ───────────────────────────────── */}
        {autoOptimizeBar && !isAutoOptimizing && (
          <div style={{
            position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
            zIndex: 10000, minWidth: 560, maxWidth: 'calc(100vw - 40px)',
            background: '#09090b', borderRadius: 10,
            boxShadow: '0 8px 40px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.3)',
            display: 'flex', alignItems: 'center', padding: '0 10px 0 16px', height: 52, gap: 10,
            flexWrap: 'nowrap',
          }}>
            {/* Status badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: '#a1a1aa', fontFamily: 'var(--font-family-primary)', whiteSpace: 'nowrap' }}>
                Article optimized
              </span>
              {pendingImageCount > 0 && (
                <span style={{ fontSize: 12, color: '#71717a', fontFamily: 'var(--font-family-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  · generating {pendingImageCount} image{pendingImageCount > 1 ? 's' : ''}…
                </span>
              )}
            </div>

            <div style={{ width: 1, height: 18, background: '#27272a', flexShrink: 0 }} />

            <div style={{ flex: 1 }} />

            {/* Compare versions */}
            {compareVersionsButton(autoOptimizeBar.preHtml)}

            {/* Retry */}
            <button
              type="button"
              onClick={() => {
                const preHtml = autoOptimizeBar.preHtml;
                setAutoOptimizeBar(null);
                const editor = (editorRef.current as any)?.getEditor?.();
                if (editor) editor.commands.setContent(preHtml);
                handleAutoOptimize(preHtml);
              }}
              style={{ fontSize: 13, fontWeight: 500, color: '#71717a', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-family-primary)', padding: '6px 10px', borderRadius: 6, transition: 'color 0.15s', display: 'flex', alignItems: 'center', gap: 5 }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#a1a1aa'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#71717a'; }}
            >
              <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M1 4v6h6M23 20v-6h-6" /><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" /></svg>
              Retry
            </button>

            {/* Discard — revert the editor to the pre-optimize state, recompute the
                score, and persist the revert so the DB matches what's shown. */}
            <button
              type="button"
              onClick={async () => {
                const preHtml = autoOptimizeBar.preHtml;
                const editor = (editorRef.current as any)?.getEditor?.();
                if (editor) editor.commands.setContent(preHtml); // reverts editor + recomputes the panel score via onChange
                setAutoOptimizeBar(null);
                setPendingImageCount(0);
                if (!id) return;
                const preText = preHtml.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
                const preWords = preText ? preText.split(/\s+/).length : 0;
                const preHeadings = (preHtml.match(/<h[1-6][\s>]/gi) || []).length;
                const preParas = (preHtml.match(/<p[\s>]/gi) || []).length;
                const preScore = scoreData
                  ? computeContentScore(preText, preWords, preHeadings, scoreData, preParas, (preHtml.match(/<a\s[^>]*href=/gi) || []).length, preHtml, article?.target_keyword || '')
                  : 0;
                try {
                  setAutoSaveState('saving');
                  await fetch(`/api/articles/${id}`, {
                    method: 'PUT', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content: preHtml, word_count: preWords, score_data: { ...scoreData, _computed_score: preScore } }),
                  });
                  setAutoSaveState('saved');
                } catch { setAutoSaveState('unsaved'); }
              }}
              style={{ fontSize: 13, fontWeight: 500, color: '#71717a', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-family-primary)', padding: '6px 10px', borderRadius: 6, transition: 'color 0.15s' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#a1a1aa'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#71717a'; }}
            >
              Discard
            </button>

            {/* Accept — snapshot the optimized content as a new version */}
            <button
              type="button"
              onClick={async () => {
                setAutoOptimizeBar(null);
                setPendingImageCount(0);
                try {
                  setAutoSaveState('saving');
                  await doSave('auto_optimize');
                  lastVersionAt.current = Date.now();
                  setAutoSaveState('saved');
                  toast.success('Changes accepted — version saved');
                } catch {
                  setAutoSaveState('unsaved');
                  toast.error('Could not save version');
                }
              }}
              style={{ fontSize: 13, fontWeight: 600, color: '#fff', background: '#16a34a', border: 'none', borderRadius: 7, cursor: 'pointer', fontFamily: 'var(--font-family-primary)', padding: '7px 16px', transition: 'background 0.15s', flexShrink: 0 }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#15803d'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#16a34a'; }}
            >
              Accept changes
            </button>
          </div>
        )}

        {/* ── AI Readability optimize: working ──────────────────────── */}
        {isApplyingReadability && (
          <div style={{
            position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
            zIndex: 500, minWidth: 560, maxWidth: 'calc(100vw - 40px)',
            background: '#09090b', borderRadius: 10,
            boxShadow: '0 8px 40px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.3)',
            display: 'flex', alignItems: 'center', padding: '0 16px', height: 52, gap: 12,
          }}>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#a1a1aa', fontFamily: 'var(--font-family-primary)' }}>Optimize AI Readability</span>
            <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.15)', borderTopColor: '#783afb', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: '#fff', fontFamily: 'var(--font-family-primary)' }}>Working</span>
          </div>
        )}

        {/* ── AI Readability optimize: result bar (Compare versions added in a later step) ── */}
        {readabilityBar && !isApplyingReadability && (
          <div style={{
            position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
            zIndex: 500, minWidth: 560, maxWidth: 'calc(100vw - 40px)',
            background: '#09090b', borderRadius: 10,
            boxShadow: '0 8px 40px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.3)',
            display: 'flex', alignItems: 'center', padding: '0 10px 0 16px', height: 52, gap: 16,
          }}>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#a1a1aa', fontFamily: 'var(--font-family-primary)', whiteSpace: 'nowrap' }}>Optimize AI Readability</span>

            {/* Compare versions */}
            {compareVersionsButton(readabilityBar.preHtml)}

            {/* Cancel — revert the editor to the pre-apply state (autosave re-persists it). */}
            <button
              type="button"
              onClick={() => {
                const preHtml = readabilityBar.preHtml;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const editor = (editorRef.current as any)?.getEditor?.();
                if (editor) editor.commands.setContent(preHtml);
                setReadabilityBar(null);
              }}
              style={{ fontSize: 13, fontWeight: 600, color: '#fff', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-family-primary)', padding: '6px 8px', borderRadius: 6, transition: 'color 0.15s' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#a1a1aa'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#fff'; }}
            >
              Cancel
            </button>

            {/* Accept — snapshot the optimized content as a new version. */}
            <button
              type="button"
              onClick={async () => {
                setReadabilityBar(null);
                try {
                  setAutoSaveState('saving');
                  await doSave('readability_optimize');
                  lastVersionAt.current = Date.now();
                  setAutoSaveState('saved');
                  setReadabilityAcceptKey((k) => k + 1);
                  toast.success('Changes accepted — version saved');
                } catch {
                  setAutoSaveState('unsaved');
                  toast.error('Could not save version');
                }
              }}
              style={{ fontSize: 13, fontWeight: 600, color: '#18181b', background: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontFamily: 'var(--font-family-primary)', padding: '7px 16px', transition: 'opacity 0.15s', flexShrink: 0 }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
            >
              Accept
            </button>
          </div>
        )}

        {/* ── Compare versions modal (shared by Auto-Optimize + AI Readability bars) ── */}
        {compareVersions && (
          <CompareVersionsModal
            original={compareVersions.original}
            updated={compareVersions.updated}
            terms={[article?.target_keyword, ...((scoreData?.terms || []).map((t) => t.term))].filter(Boolean) as string[]}
            onClose={() => setCompareVersions(null)}
          />
        )}

        {/* ── Link review floating modal (Surfy-style) ─────────────── */}
        {linkBar && (
          <div style={{
            position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
            zIndex: 500, width: 560, maxWidth: 'calc(100vw - 40px)',
            background: '#09090b', borderRadius: 10,
            boxShadow: '0 8px 40px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.3)',
            display: 'flex', alignItems: 'center', padding: '0 10px 0 16px', height: 52, gap: 10,
          }}>
            {/* Link count badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#783afb', flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: '#a1a1aa', fontFamily: 'var(--font-family-primary)', whiteSpace: 'nowrap' }}>
                {linkBar.count} link{linkBar.count !== 1 ? 's' : ''} inserted
              </span>
            </div>

            <div style={{ width: 1, height: 18, background: '#27272a', flexShrink: 0 }} />

            {/* Navigation ↑↓ */}
            <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
              {[{ label: '↑', dir: -1 }, { label: '↓', dir: 1 }].map(({ label, dir }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    const positions = linkBar.positions;
                    if (!positions.length) return;
                    const next = Math.max(0, Math.min(positions.length - 1, linkNavIdx + dir));
                    setLinkNavIdx(next);
                    const editor = editorRef.current?.getEditor();
                    if (editor) {
                      editor.chain().focus().setTextSelection({ from: positions[next], to: positions[next] + 1 }).scrollIntoView().run();
                    }
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 6, border: 'none', background: '#1c1c1f', color: '#a1a1aa', cursor: 'pointer', fontSize: 13, transition: 'background 0.15s, color 0.15s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#27272a'; e.currentTarget.style.color = '#fff'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#1c1c1f'; e.currentTarget.style.color = '#a1a1aa'; }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div style={{ flex: 1 }} />

            {/* Cancel */}
            <button
              type="button"
              onClick={() => {
                const editor = editorRef.current?.getEditor();
                if (editor) editor.commands.setContent(linkBar.preLinkHtml);
                setLinkBar(null);
              }}
              style={{ fontSize: 13, fontWeight: 500, color: '#71717a', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-family-primary)', padding: '6px 10px', borderRadius: 6, transition: 'color 0.15s' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#a1a1aa'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#71717a'; }}
            >
              Discard
            </button>

            {/* Accept */}
            <button
              type="button"
              onClick={() => setLinkBar(null)}
              style={{ fontSize: 13, fontWeight: 600, color: '#fff', background: '#783afb', border: 'none', borderRadius: 7, cursor: 'pointer', fontFamily: 'var(--font-family-primary)', padding: '7px 16px', transition: 'background 0.15s', flexShrink: 0 }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#6d28d9'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#783afb'; }}
            >
              Accept links
            </button>
          </div>
        )}

        {/* Pixabay image search modal */}
        {showPixabay && (
          <PixabayImageModal
            defaultQuery={article?.target_keyword || ''}
            onSelect={handlePixabaySelect}
            onClose={() => setShowPixabay(false)}
          />
        )}

        {/* Content Editor customization panel */}
        <CustomizationPanelModal
          open={showCustomization}
          keyword={article?.target_keyword || ''}
          onClose={() => setShowCustomization(false)}
        />

        {/* First-visit onboarding coachmark (Ask Surfy + Content Score) */}
        <EditorOnboarding />

        {/* ── AI glow overlay — last child so it renders above everything ── */}
        <AiGlowRing active={isAiActive} />
      </div>
    </AppShell>
  );
};

export default ArticleEditorPage;
