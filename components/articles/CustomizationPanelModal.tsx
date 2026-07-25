import React, { useEffect, useRef, useState } from 'react';
import CompetitorsSection from '../competitors/CompetitorsSection';

/* ── Design tokens ─────────────────────────────────────────────── */
const C = {
  text: '#18181B', g160: '#09090B', g140: '#18181B', g120: '#2F2F34', g100: '#3F3F47', g80: '#52525C',
  g60: '#9F9FA9', g40: '#D4D4D8', g20: '#E4E4E7', g10: '#F4F4F5', g5: '#F8F8F9',
  purple: '#F29964', purple80: '#630DE3', purple100: '#B86A42', purple40: '#F5C4A0',
  purple10: '#FDE8D8', purple5: '#F1EBFE',
  yellow: '#EFA00D', green: '#1AB25E', red: '#FB5D5D', blue: '#155DFC',
};
const F = 'var(--font-family-primary)';

/* ── Data ──────────────────────────────────────────────────────── */
type Competitor = {
  pos: number; url: string; sub?: string; title: string; snippet: string;
  score: number; authority: number; auth: 'red' | 'yellow' | 'green'; words: string; on: boolean;
};
const COMPETITORS: Competitor[] = [
  { pos: 1, url: 'https://madebyrogal.com', title: 'Projektowanie aplikacji webowych od A do Z - kompletny przewodnik krok ...', snippet: '18 sie 2025 — Przy tworzeniu aplikacji webowych po stronie frontendowej najczęściej wybiera się technologie takie jak React.js, Vue.js czy Angular, natomiast ...', score: 58, authority: 1, auth: 'red', words: '1,237', on: true },
  { pos: 2, url: 'https://it-solve.pl', title: 'Tworzenie aplikacji webowych - aplikacje internetowe dla firm', snippet: 'Zajmujemy się kompleksowym tworzeniem aplikacji webowych, począwszy od wstępnych analiz poprzez projektowanie, skończywszy na wdrożeniu i ulepszaniu.', score: 49, authority: 4, auth: 'yellow', words: '1,283', on: false },
  { pos: 3, url: 'https://www.youtube.com', sub: 'Wyświetlenia: ponad 90,3 tys.  ·  5 lat temu', title: 'ASP.NET Core - Tworzenie aplikacji webowych #1', snippet: 'Półtora godziny gościnnego kursu na temat ASP.NET, przygotowanego przez Kubę Kozerę z kanału Fullstack Developer.', score: 42, authority: 10, auth: 'green', words: '840', on: false },
  { pos: 4, url: 'https://thestory.is', title: 'Aplikacje webowe - The Story', snippet: 'Piszemy od zera aplikacje i serwisy internetowe. Kierujemy się zasadą clean code i stosujemy popularne technologie (Python, PHP, React, JavaScript, Django, ...', score: 17, authority: 6, auth: 'yellow', words: '717', on: false },
  { pos: 5, url: 'https://develtio.pl', title: 'Tworzenie i projektowanie aplikacji webowych', snippet: 'Oferujemy tworzenie dedykowanych aplikacji webowych, które automatyzują procesy, oszczędzają czas i zwiększają efektywność Twojego biznesu.', score: 58, authority: 2, auth: 'red', words: '1,184', on: true },
  { pos: 6, url: 'https://www.poldevs.com', title: 'Tworzenie aplikacji webowych | Poldevs Software House', snippet: 'Ile trwa tworzenie aplikacji webowej? Od 4-5 tygodni w przypadku małej aplikacji do około 6-9 miesięcy w przypadku bardziej rozbudowanych aplikacji. Tomasz ...', score: 51, authority: 1, auth: 'red', words: '374', on: false },
  { pos: 7, url: 'https://impicode.pl', title: 'Tworzenie aplikacji internetowych', snippet: 'Tworzymy aplikacje internetowe i webowe dla Twojego biznesu. Budujemy zarówno frontend (zazwyczaj: Angular, React.js, Vue.js) jak i backend (zazwyczaj: Django, ...', score: 67, authority: 3, auth: 'red', words: '5,828', on: true },
  { pos: 8, url: 'https://sopchy.com', title: 'Tworzenie aplikacji webowych', snippet: 'Tworzymy aplikacje internetowe, systemy ERP, CRM oraz rozwiązania korzystające z technologii OCR. Posiadamy doświadczony zespół programistów, ...', score: 53, authority: 3, auth: 'red', words: '641', on: true },
  { pos: 9, url: 'https://nofluffjobs.com', title: 'Aplikacja webowa. Od czego zacząć projektowanie aplikacji', snippet: '7 mar 2024 — Krok 1 – Określ cel i funkcjonalność aplikacji webowej. Zanim przystąpisz do projektowania aplikacji, musisz mieć jasny pomysł na to, co chcesz ...', score: 23, authority: 7, auth: 'green', words: '550', on: false },
  { pos: 10, url: 'https://www.davinci-studio.com', title: 'Architektura aplikacji internetowej i proces tworzenia aplikacji webowych', snippet: '16 sie 2024 — Mając ten krótki wstęp za sobą, wyjaśnijmy, czy tak naprawdę jest aplikacja internetowa i jak wygląda architektura takich aplikacji. Czym jest ...', score: 56, authority: 3, auth: 'red', words: '1,277', on: true },
];

type Term = { text: string; heading?: boolean };
const HEADING_TERMS = new Set([
  'tworzenie aplikacji webowych', 'proces tworzenia aplikacji webowych', 'proces tworzenia aplikacji',
  'bazy danych', 'procesów biznesowych', 'cele biznesowe', 'innymi usługami',
]);
const TERMS: Term[] = [
  'tworzenie aplikacji webowych', 'aplikacji webowych', 'aplikacji internetowych', 'proces tworzenia aplikacji webowych', 'wdrożeniu aplikacji webowej',
  'trwa tworzenie aplikacji webowej', 'interfejsów użytkownika', 'tworzymy aplikacje internetowe', 'przeglądarce internetowej', 'różnych urządzeniach',
  'proces tworzenia aplikacji', 'projekt graficzny', 'pojedynczych funkcji', 'bazy danych', 'stron internetowych', 'systemach operacyjnych',
  'złożoności projektu', 'procesów biznesowych', 'sklepy internetowe', 'warstwy prezentacji', 'logikę biznesową', 'każdym urządzeniu',
  'cele biznesowe', 'tworzenie aplikacji', 'systemy internetowe', 'nowe funkcje', 'zewnętrznymi systemami', 'minimum viable product',
  'aplikacja', 'innymi usługami', 'czasie rzeczywistym', 'wyszukiwarce google', 'szeroki wachlarz', 'twojego biznesu', 'użytkowników',
  'możesz wejść', 'przeglądarce', 'główną zaletą', 'następnie przechodzimy', 'masz dostęp', 'rozwiązania', 'projektowanie',
  'funkcjonalności', 'proces', 'testowanie', 'testów', 'tester', 'pobierania', 'oprogramowanie', 'programowanie', 'stworzenie', 'komputerze',
  'konieczności', 'integracje', 'klienci', 'wydajności', 'internetu', 'formularze', 'projektu', 'interfejs', 'serwer',
].map((text) => ({ text, heading: HEADING_TERMS.has(text) }));

type Topic = { topic: string; source: 'paa' | 'comp'; checked: boolean };
const TOPICS: Topic[] = [
  { topic: 'Ile kosztuje stworzenie aplikacji webowej?', source: 'paa', checked: true },
  { topic: 'Czy można samemu stworzyć aplikację?', source: 'paa', checked: true },
  { topic: 'Jak zrobić aplikację ze strony internetowej?', source: 'paa', checked: true },
  { topic: 'Ile można zarobić na stworzeniu aplikacji?', source: 'paa', checked: true },
  { topic: 'Architektura aplikacji internetowej i proces tworzenia aplikacji webowych', source: 'comp', checked: false },
  { topic: 'Projektowanie aplikacji webowych od A do Z - kompletny przewodnik krok po kroku', source: 'comp', checked: false },
  { topic: 'Tworzymy aplikacje internetowe i webowe dla Twojego biznesu.', source: 'comp', checked: false },
  { topic: 'Aplikacje webowe szyte na miarę rozwoju Twojego biznesu', source: 'comp', checked: false },
];

/* ── Primitive components ──────────────────────────────────────── */
const SemicircleGauge = ({ score, size = 48 }: { score: number; size?: number }) => {
  const s = Math.max(0, Math.min(100, score));
  const angle = (180 * (1 - s / 100)) * Math.PI / 180;
  const x = 150 + 120 * Math.cos(angle);
  const y = 150 - 120 * Math.sin(angle);
  const color = s < 33 ? C.red : s < 67 ? C.yellow : C.green;
  return (
    <svg viewBox="0 0 300 175" width={size} height={size * 175 / 300} style={{ verticalAlign: 'middle' }}>
      <path fill="transparent" stroke={C.g20} strokeWidth={30} strokeLinecap="round" d="M 270 150 A 120 120 0 0 0 30 150" />
      <path fill="transparent" stroke={color} strokeWidth={30} strokeLinecap="round" d={`M ${x} ${y} A 120 120 0 0 0 30 150`} />
      <text x="150" y="90" fill={C.g120} textAnchor="middle" dominantBaseline="text-before-edge" fontFamily={F} fontWeight={500} fontSize={72} style={{ letterSpacing: '0.02em' }}>{s}</text>
    </svg>
  );
};

const AUTH_COLORS = {
  red: { main: '#FB5D5D', light: '#FCA5A5' },
  yellow: { main: '#EFA00D', light: '#FCD34D' },
  green: { main: '#1AB25E', light: '#6EE7A8' },
};
const AuthorityShield = ({ n, color }: { n: number; color: 'red' | 'yellow' | 'green' }) => {
  const col = AUTH_COLORS[color];
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 28 }}>
      <svg width={24} height={28} viewBox="0 0 24 28">
        <path d="M24 5C18.1667 3.83337 12 0 12 0C12 0 5.83334 3.83337 4.03325e-06 5L0 14C0.135798 24.5 12 28 12 28C12 28 24 24.5 24 14V5Z" fill={col.main} />
        <path d="M12 0C12 0 5.83334 3.83337 4.03325e-06 5L0 14C0.135798 24.5 12 28 12 28V0Z" fill={col.light} />
      </svg>
      <span style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-52%)', color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: F }}>{n}</span>
    </div>
  );
};

const Toggle = ({ on }: { on: boolean }) => (
  <span style={{
    display: 'inline-block', width: 32, height: 16, borderRadius: 32, position: 'relative',
    background: on ? C.purple : C.g60, transition: 'background 0.25s', flexShrink: 0,
  }}>
    <span style={{
      position: 'absolute', top: 0, left: on ? 16 : 0, width: 16, height: 16, borderRadius: '50%',
      background: '#fff', boxShadow: '0 1px 2px rgba(24,26,34,0.2)', transition: 'left 0.25s',
    }} />
  </span>
);

const Checkbox = ({ checked, size = 20 }: { checked: boolean; size?: number }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size,
    borderRadius: 4, flexShrink: 0,
    background: checked ? C.purple : '#fff',
    boxShadow: checked ? 'none' : `inset 0 0 0 1px ${C.g40}, 0px 1px 2px 0px rgba(26,29,40,0.06)`,
  }}>
    {checked && (
      <svg viewBox="0 0 20 20" width={size * 0.8} height={size * 0.8}>
        <path fill="#fff" fillRule="evenodd" d="M16.705 4.153a.75.75 0 0 1 .142 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893l7.48-9.817a.75.75 0 0 1 1.05-.143" clipRule="evenodd" />
      </svg>
    )}
  </span>
);

const StepBtn = ({ kind, onClick }: { kind: 'minus' | 'plus'; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36,
      borderRadius: 24, border: `1px solid ${C.g20}`, background: C.g5, cursor: 'pointer',
      color: '#18181B', flexShrink: 0,
    }}
    onMouseDown={(e) => { e.currentTarget.style.background = C.g10; }}
    onMouseUp={(e) => { e.currentTarget.style.background = C.g5; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = C.g5; }}
  >
    <svg viewBox="0 0 20 20" width={12} height={12} fill="currentColor">
      {kind === 'minus'
        ? <path fillRule="evenodd" d="M4 10a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H4.75A.75.75 0 0 1 4 10" clipRule="evenodd" />
        : <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5z" />}
    </svg>
  </button>
);

const Favicon = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" style={{ flexShrink: 0, borderRadius: 4 }}>
    <path fill="none" stroke={C.g60} strokeWidth={1.5} d="M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18ZM3.6 9h16.8M3.6 15h16.8M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
  </svg>
);

const PLFlag = () => (
  <svg width={24} height={18} viewBox="0 0 24 18" style={{ borderRadius: 2, boxShadow: '0 0 1px rgba(0,0,0,0.5)', flexShrink: 0 }}>
    <rect width={24} height={9} fill="#fff" />
    <rect y={9} width={24} height={9} fill="#DC143C" />
  </svg>
);

const RanksmileLogo = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <span style={{ width: 26, height: 26, borderRadius: 6, background: '#FF5A1F', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg viewBox="0 0 20 20" width={13} height={13}>
        <path fill="#fff" d="M3 4h14v3H3zM3 9h9v3H3zM3 14h12v3H3z" />
      </svg>
    </span>
    <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.01em', color: C.g160, fontFamily: F }}>RANKSMILE</span>
  </div>
);

/* ── Sidebar nav icons ─────────────────────────────────────────── */
const navIcon = (key: string) => {
  const common = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, strokeWidth: 1.5 };
  switch (key) {
    case 'competitors':
      return <path {...common} d="M15 19.128a9.4 9.4 0 0 0 2.625.372a9.3 9.3 0 0 0 4.121-.952q.004-.086.004-.173a4.125 4.125 0 0 0-7.536-2.32M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.3 12.3 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0a3.375 3.375 0 0 1 6.75 0m8.25 2.25a2.625 2.625 0 1 1-5.25 0a2.625 2.625 0 0 1 5.25 0" />;
    case 'structure':
      return <path {...common} d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3l5.571-3m-11.142 0L2.25 7.5L12 2.25l9.75 5.25l-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75L2.25 16.5l4.179-2.25m11.142 0l-5.571 3l-5.571-3" />;
    case 'terms':
      return <path {...common} d="M9 12.75L11.25 15L15 9.75M21 12a9 9 0 1 1-18 0a9 9 0 0 1 18 0" />;
    case 'topics':
      return <path {...common} d="M9.879 7.519c1.172-1.025 3.071-1.025 4.243 0c1.171 1.025 1.171 2.687 0 3.712q-.308.268-.67.442c-.746.361-1.452.999-1.452 1.827v.75M21 12a9 9 0 1 1-18 0a9 9 0 0 1 18 0m-9 5.25h.008v.008H12z" />;
    default: return null;
  }
};

const NAV = [
  { key: 'competitors', label: 'Competitors' },
  { key: 'structure', label: 'Content Structure' },
  { key: 'terms', label: 'Terms' },
  { key: 'topics', label: 'Topics & Questions' },
];

const COL_ITEMS = [
  { key: 'authority', label: 'Authority (Domain)' },
  { key: 'breadcrumbs', label: 'Breadcrumbs' },
  { key: 'contentScore', label: 'Content Score' },
  { key: 'descriptions', label: 'Descriptions' },
  { key: 'words', label: 'Words' },
];

const InfoIcon = () => (
  <svg viewBox="0 0 20 20" width={16} height={16} style={{ flexShrink: 0 }}>
    <path fill={C.g80} fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0a8 8 0 0 1 16 0m-7-4a1 1 0 1 1-2 0a1 1 0 0 1 2 0M9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9z" clipRule="evenodd" />
  </svg>
);
const DotsIcon = ({ color = C.g100 }: { color?: string }) => (
  <svg viewBox="0 0 24 24" width={20} height={20}>
    <path fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.75 12a.75.75 0 1 1-1.5 0a.75.75 0 0 1 1.5 0m6 0a.75.75 0 1 1-1.5 0a.75.75 0 0 1 1.5 0m6 0a.75.75 0 1 1-1.5 0a.75.75 0 0 1 1.5 0" />
  </svg>
);
const SearchIcon = () => (
  <svg viewBox="0 0 24 24" width={20} height={20}>
    <path fill="none" stroke={C.g100} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607" />
  </svg>
);
const RefreshIcon = () => (
  <svg viewBox="0 0 20 20" width={16} height={16}>
    <path fill={C.g80} fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138a.75.75 0 0 0-1.449-.39m1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0V5.36l-.31-.31A7 7 0 0 0 3.239 8.188a.75.75 0 1 0 1.448.389A5.5 5.5 0 0 1 13.89 6.11l.311.31h-2.432a.75.75 0 0 0 0 1.5h4.243a.75.75 0 0 0 .53-.219" clipRule="evenodd" />
  </svg>
);

const TableInfoIcon = () => (
  <svg viewBox="0 0 24 24" width={16} height={16} style={{ flexShrink: 0 }}>
    <path fill="none" stroke={C.g100} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0a9 9 0 0 1 18 0m-9-3.75h.008v.008H12z" />
  </svg>
);

const InfoTip = ({ text, align = 'center' }: { text: string; align?: 'center' | 'right' | 'left' }) => {
  const [show, setShow] = useState(false);
  const pos: React.CSSProperties = align === 'center'
    ? { left: '50%', transform: 'translateX(-50%)' }
    : align === 'right' ? { right: -6 } : { left: -6 };
  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'default' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <TableInfoIcon />
      {show && (
        <span style={{
          position: 'absolute', top: 'calc(100% + 8px)', ...pos, zIndex: 1000,
          width: 'max-content', maxWidth: 260, padding: '10px 12px', borderRadius: 8,
          background: C.g160, color: '#fff', fontSize: 14, lineHeight: '1.35rem', fontWeight: 400,
          fontFamily: F, textAlign: 'left', whiteSpace: 'normal', textTransform: 'none', letterSpacing: 'normal',
          boxShadow: '0px 8px 16px rgba(24,26,34,0.24)', pointerEvents: 'none',
        }}>{text}</span>
      )}
    </span>
  );
};

const TIP_SEO = 'The SEO Score is a number between 1 and 100 that grades how well the content is optimized for search engines.';
const TIP_AUTH = 'Authority is a number between 1 and 10 and reflects how strong is the backlink profile for this domain.';
const TIP_WORDS = 'Number of words on this page';

/* ── Section building blocks ───────────────────────────────────── */
const SectionHeader = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <>
    <h2 style={{ margin: 0, fontSize: 24, lineHeight: '2rem', fontWeight: 600, color: C.g120, fontFamily: F }}>{title}</h2>
    <p style={{ marginTop: 12, marginBottom: 24, fontSize: 16, lineHeight: '1.5rem', color: C.g100, fontFamily: F }}>{children}</p>
  </>
);
const LearnMore = () => (
  <a href="#" onClick={(e) => e.preventDefault()} style={{ color: C.text, textDecoration: 'underline', textUnderlineOffset: '0.05em', fontFamily: F }}>Learn more.</a>
);

/* ── Adjustment card (structure) ───────────────────────────────── */
const AdjustCard = ({ label, value, range, onMinus, onPlus, dropdown, dropdownValue, dropdownOptions, onSelectOption }: {
  label?: React.ReactNode; value: number; range: string; onMinus: () => void; onPlus: () => void;
  dropdown?: boolean; dropdownValue?: string; dropdownOptions?: string[]; onSelectOption?: (v: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const ddRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e: MouseEvent) => { if (ddRef.current && !ddRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, height: 200, width: 224 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <span style={{ padding: 4, display: 'flex' }}><RefreshIcon /></span>
        {dropdown ? (
          <div ref={ddRef} style={{ position: 'relative' }}>
            <button type="button" onClick={() => setOpen((o) => !o)} style={{
              display: 'flex', alignItems: 'center', height: 40, padding: '2px 8px 2px 12px', gap: 4,
              border: `1px solid ${open ? C.purple40 : C.g40}`, borderRadius: 8, background: '#fff', cursor: 'pointer',
              boxShadow: open ? '0 0 0 4px rgba(242,153,100,0.1)' : '0px 1px 2px 0px rgba(26,29,40,0.06)', fontFamily: F,
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}>
              <span style={{ fontSize: 14, color: C.text }}>{dropdownValue}</span>
              <svg viewBox="0 0 20 20" width={20} height={20} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><path fill={C.text} fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06" clipRule="evenodd" /></svg>
            </button>
            {open && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 4px)', left: 0, minWidth: '100%', zIndex: 200,
                background: '#fff', borderRadius: 6, padding: '4px 0', boxShadow: '0px 8px 16px rgba(24,26,34,0.12), 0px 1px 2px rgba(24,26,34,0.1)',
                animation: 'growOut 0.18s cubic-bezier(0.16,1,0.3,1)',
              }}>
                {(dropdownOptions || []).map((opt) => {
                  const sel = opt === dropdownValue;
                  return (
                    <button key={opt} type="button" onClick={() => { onSelectOption?.(opt); setOpen(false); }} style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%', margin: '0 4px', padding: '8px 16px',
                      border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6,
                      fontSize: 14, fontWeight: 500, color: C.g120, fontFamily: F, whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = C.g5; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      {opt}
                      {sel && <svg viewBox="0 0 20 20" width={16} height={16} style={{ marginLeft: 'auto' }}><path fill={C.text} fillRule="evenodd" d="M16.705 4.153a.75.75 0 0 1 .142 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893l7.48-9.817a.75.75 0 0 1 1.05-.143" clipRule="evenodd" /></svg>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <span style={{ padding: '8px 16px', fontSize: 14, color: C.g100, fontFamily: F, userSelect: 'none' }}>{label}</span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <StepBtn kind="minus" onClick={onMinus} />
        <div style={{ width: 75, textAlign: 'center', fontSize: 20, lineHeight: '1.75rem', fontWeight: 500, color: C.text, fontFamily: F }}>{value}</div>
        <StepBtn kind="plus" onClick={onPlus} />
      </div>
      <div style={{ marginTop: 8, fontSize: 16, color: C.g100, fontFamily: F }}>{range}</div>
    </div>
  );
};

/* ── Terms tab pill ────────────────────────────────────────────── */
const TermTab = ({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) => (
  <button type="button" onClick={onClick} style={{
    padding: '12px 0 10px', fontSize: 14, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.01em',
    color: active ? C.purple100 : C.g80, fontFamily: F, background: 'none', border: 'none', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 8, borderBottom: active ? `2px solid ${C.purple80}` : '2px solid transparent',
    marginBottom: -1, flexShrink: 0,
  }}>
    {label}
    <span style={{ background: active ? C.purple80 : C.g80, color: '#fff', fontSize: 11, fontWeight: 500, lineHeight: '0.875rem', letterSpacing: '0.02em', textTransform: 'uppercase', borderRadius: 4, padding: '1px 5px' }}>{count}</span>
  </button>
);

const ActionBtn = ({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) => (
  <button type="button" disabled={disabled} style={{
    padding: '6px 16px', borderRadius: 6, fontSize: 14, fontWeight: 600, fontFamily: F,
    background: C.g10, color: C.text, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1, whiteSpace: 'nowrap',
  }}
  onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = C.g20; }}
  onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.background = C.g10; }}
  >{children}</button>
);

/* ── Term chip ─────────────────────────────────────────────────── */
const TermChip = ({ term }: { term: Term }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 8, margin: 4, padding: '8px 12px', borderRadius: 24,
    border: `1px solid ${C.g40}`, color: C.g160, fontSize: 14, fontFamily: F, cursor: 'pointer',
    background: '#fff', userSelect: 'none', transition: 'background 0.15s',
  }}
  onMouseEnter={(e) => { e.currentTarget.style.background = C.g10; }}
  onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
  >
    <span style={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{term.text}</span>
    <span style={{
      width: 16, height: 16, borderRadius: 2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: term.heading ? C.yellow : C.g80, color: '#fff', fontSize: 11, fontWeight: 400, lineHeight: '1rem', flexShrink: 0,
    }}>H</span>
    <Checkbox checked size={16} />
  </div>
);

/* ── Topic source badge ────────────────────────────────────────── */
const SourceBadge = ({ source }: { source: 'paa' | 'comp' }) => {
  const isPaa = source === 'paa';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 24, padding: '0 8px',
      borderRadius: 4, border: `1px solid ${isPaa ? C.blue : C.green}`, color: isPaa ? C.blue : C.green,
      fontSize: 13, fontWeight: 600, textTransform: 'uppercase', fontFamily: F, whiteSpace: 'nowrap',
    }}>{isPaa ? 'people also ask' : 'competitors'}</span>
  );
};

/* ── Main component ────────────────────────────────────────────── */
type Props = { open: boolean; slug: string | undefined; keyword: string; onClose: () => void };

const CustomizationPanelModal = ({ open, slug, keyword, onClose }: Props) => {
  const [active, setActive] = useState('competitors');
  const [learn, setLearn] = useState(true);
  const [structure, setStructure] = useState({ words: 2034, headings: 31, paragraphs: 48, images: 46 });
  const [wordUnit, setWordUnit] = useState('WORDS');
  const [termsTab, setTermsTab] = useState('all');
  const [topicsTab, setTopicsTab] = useState('all');
  const [page, setPage] = useState(1);
  const [termList, setTermList] = useState<Term[]>(TERMS);
  const [termQuery, setTermQuery] = useState('');
  const [termFocus, setTermFocus] = useState(false);
  const [colMenu, setColMenu] = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState({ authority: true, breadcrumbs: true, contentScore: true, descriptions: true, words: true });
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstSave = useRef(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  const refs: Record<string, React.RefObject<HTMLDivElement>> = {
    competitors: useRef<HTMLDivElement>(null),
    structure: useRef<HTMLDivElement>(null),
    terms: useRef<HTMLDivElement>(null),
    topics: useRef<HTMLDivElement>(null),
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!colMenu) return undefined;
    const onDoc = (e: MouseEvent) => { if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setColMenu(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [colMenu]);

  // Auto-save: any settings change shows a "Saving…" → "Saved" indicator (debounced).
  useEffect(() => {
    if (firstSave.current) { firstSave.current = false; return undefined; }
    setSaveState('saving');
    saveTimer.current = setTimeout(() => {
      setSaveState('saved');
      savedTimer.current = setTimeout(() => setSaveState('idle'), 1600);
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, [structure, wordUnit, show, termList]);

  const handleScroll = () => {
    const cont = scrollRef.current;
    if (!cont) return;
    const top = cont.getBoundingClientRect().top + 140;
    let current = 'competitors';
    NAV.forEach(({ key }) => {
      const el = refs[key].current;
      if (el && el.getBoundingClientRect().top <= top) current = key;
    });
    setActive(current);
  };

  const goTo = (key: string) => {
    setActive(key);
    refs[key].current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const q = termQuery.trim().toLowerCase();
  const filteredTerms = q ? termList.filter((t) => t.text.toLowerCase().includes(q)) : termList;
  const termTotal = q ? filteredTerms.length : 273;
  const nlpTotal = q ? filteredTerms.length : 268;
  const hasExact = q ? termList.some((t) => t.text.toLowerCase() === q) : true;
  const addTerm = () => {
    const t = termQuery.trim();
    if (!t) return;
    setTermList((prev) => [{ text: t, heading: false }, ...prev]);
    setTermQuery('');
  };

  if (!open) return null;

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)', fontFamily: F,
      }}
    >
      <div
        role="dialog"
        aria-label="Customization panel"
        style={{
          background: '#fff', color: C.text, display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
          maxHeight: '85vh', width: 'calc(100% - 40px)', maxWidth: 1520, borderRadius: 8, overflow: 'hidden',
          boxShadow: '0px 16px 32px 0px rgba(24,26,34,0.32), 0px 2px 4px 0px rgba(24,26,34,0.16), 0px 1px 1px 0px rgba(0,0,0,0.04)',
          animation: 'growOut 0.2s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
          {/* ── Sidebar ──────────────────────────────── */}
          <div style={{
            minWidth: 234, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            padding: '32px 16px', borderRight: `1px solid ${C.g10}`, boxShadow: 'inset -6px 0px 12px rgba(0,0,0,0.05)',
            overflowY: 'auto',
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'center' }}><RanksmileLogo /></div>
              <div style={{ padding: '48px 0' }}>
                {NAV.map(({ key, label }) => {
                  const on = active === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => goTo(key)}
                      style={{
                        display: 'flex', alignItems: 'center', width: '100%', marginBottom: 12, padding: 12,
                        gap: 12, fontSize: 16, fontWeight: on ? 500 : 400, fontFamily: F,
                        color: on ? C.purple : C.g100, background: 'transparent', border: 'none', cursor: 'pointer',
                        transition: 'color 0.15s, opacity 0.15s',
                      }}
                      onMouseEnter={(e) => { if (!on) e.currentTarget.style.opacity = '0.7'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                    >
                      <svg viewBox="0 0 24 24" width={20} height={20} style={{ flexShrink: 0 }}>{navIcon(key)}</svg>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {learn && (
              <div style={{ margin: '8px 0', padding: '8px 8px 16px', borderRadius: 12, border: `1px solid ${C.g10}`, background: C.g5, color: C.g160 }}>
                <div style={{ textAlign: 'right' }}>
                  <button type="button" onClick={() => setLearn(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.g100, padding: 0 }}>
                    <svg viewBox="0 0 24 24" width={20} height={20}><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ padding: '16px 0', fontSize: 14, lineHeight: '1.25rem', color: C.g160, fontFamily: F }}>Wanna learn how to<br />use Content Editor?</div>
                  <a href="https://ranksmile.pl" target="_blank" rel="noopener noreferrer" style={{
                    display: 'inline-flex', alignItems: 'center', padding: '4px 16px', borderRadius: 6, background: C.g10,
                    color: C.g160, fontSize: 14, fontWeight: 600, fontFamily: F, textDecoration: 'none',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = C.g20; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = C.g10; }}
                  >Learn now</a>
                </div>
              </div>
            )}
          </div>

          {/* ── Main column ─────────────────────────── */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            {/* Language bar */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '8px 16px',
              borderBottom: `1px solid ${C.g20}`, background: '#fff', flexShrink: 0,
            }}>
              <PLFlag />
              <span style={{ fontSize: 16, fontWeight: 500, color: C.g100, fontFamily: F, margin: '0 8px' }}>{keyword || 'tworzenie aplikacji webowych'}</span>
              <InfoIcon />
            </div>

            {/* Scroll body */}
            <div ref={scrollRef} onScroll={handleScroll} className="styled-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {/* Competitors */}
              <div ref={refs.competitors} style={{ padding: 16 }}>
                <SectionHeader title="Organic Competitors">
                  Your content guidelines will be based on competitors you choose.<br />
                  Pick at least five URLs for the most relevant results. <LearnMore />
                </SectionHeader>

                {slug ? <CompetitorsSection slug={slug} keyword={keyword} /> : <div style={{ padding: 16, fontSize: 14, color: C.g100, fontFamily: F }}>Select a domain to load competitors.</div>}
              </div>

              {/* Content Structure */}
              <div ref={refs.structure} style={{ padding: 16 }}>
                <SectionHeader title="Content Structure">
                  Your content structure elements are calculated based on the competitors you picked for the analysis. <LearnMore />
                </SectionHeader>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <AdjustCard dropdown dropdownValue={wordUnit} dropdownOptions={['WORDS', 'CHARACTERS']} onSelectOption={setWordUnit}
                    value={structure.words} range={`${structure.words}–${structure.words + 305}`}
                    onMinus={() => setStructure((s) => ({ ...s, words: Math.max(0, s.words - 10) }))}
                    onPlus={() => setStructure((s) => ({ ...s, words: s.words + 10 }))} />
                  <div style={{ display: 'flex', alignItems: 'center', alignSelf: 'stretch', padding: '0 4px' }}>
                    <div style={{ width: 1, background: C.g40, alignSelf: 'center', height: 80 }} />
                    <svg viewBox="0 0 256 256" width={20} height={20} style={{ color: C.g100, margin: '0 4px' }}><path fill="currentColor" d="M80 120h96a8 8 0 0 1 0 16H80a8 8 0 0 1 0-16m24 48H64a40 40 0 0 1 0-80h40a8 8 0 0 0 0-16H64a56 56 0 0 0 0 112h40a8 8 0 0 0 0-16m88-96h-40a8 8 0 0 0 0 16h40a40 40 0 0 1 0 80h-40a8 8 0 0 0 0 16h40a56 56 0 0 0 0-112" /></svg>
                    <div style={{ width: 1, background: C.g40, alignSelf: 'center', height: 80 }} />
                  </div>
                  <AdjustCard label="HEADINGS" value={structure.headings} range={`${structure.headings}–86`}
                    onMinus={() => setStructure((s) => ({ ...s, headings: Math.max(0, s.headings - 1) }))}
                    onPlus={() => setStructure((s) => ({ ...s, headings: s.headings + 1 }))} />
                  <AdjustCard label="PARAGRAPHS" value={structure.paragraphs} range={`${structure.paragraphs}+`}
                    onMinus={() => setStructure((s) => ({ ...s, paragraphs: Math.max(0, s.paragraphs - 1) }))}
                    onPlus={() => setStructure((s) => ({ ...s, paragraphs: s.paragraphs + 1 }))} />
                  <AdjustCard label="IMAGES" value={structure.images} range={`${structure.images}–143`}
                    onMinus={() => setStructure((s) => ({ ...s, images: Math.max(0, s.images - 1) }))}
                    onPlus={() => setStructure((s) => ({ ...s, images: s.images + 1 }))} />
                </div>
              </div>

              {/* Terms */}
              <div ref={refs.terms} style={{ padding: 16 }}>
                <SectionHeader title="Terms to Use">
                  Ranksmile extracts prominent words and phrases for your main query.<br />
                  You can add or remove them from the list. <LearnMore />
                </SectionHeader>

                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 0, borderBottom: `1px solid ${C.g20}`, marginBottom: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
                    <TermTab label="All terms" count={termTotal} active={termsTab === 'all'} onClick={() => setTermsTab('all')} />
                    <TermTab label="Included terms" count={80} active={termsTab === 'included'} onClick={() => setTermsTab('included')} />
                    <TermTab label="NLP" count={nlpTotal} active={termsTab === 'nlp'} onClick={() => setTermsTab('nlp')} />
                    <TermTab label="Ignored terms" count={0} active={termsTab === 'ignored'} onClick={() => setTermsTab('ignored')} />
                  </div>
                  <div style={{ flex: 1 }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 8 }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <span style={{ position: 'absolute', left: 10, display: 'flex', pointerEvents: 'none' }}>
                        <svg viewBox="0 0 24 24" width={18} height={18}><path fill="none" stroke={termFocus ? C.g120 : C.g80} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607" /></svg>
                      </span>
                      <input
                        value={termQuery}
                        onChange={(e) => setTermQuery(e.target.value)}
                        onFocus={() => setTermFocus(true)}
                        onBlur={() => setTermFocus(false)}
                        placeholder="Search"
                        style={{
                          width: 240, height: 40, padding: '0 12px 0 36px', boxSizing: 'border-box', borderRadius: 8,
                          border: `1px solid ${termFocus ? C.purple40 : C.g40}`, outline: 'none', fontSize: 14, fontFamily: F, color: C.text,
                          boxShadow: termFocus ? '0 0 0 4px rgba(242,153,100,0.1)' : '0px 1px 2px rgba(26,29,40,0.06)',
                          transition: 'border-color 0.15s, box-shadow 0.15s',
                        }}
                      />
                    </div>
                    <DotsIcon />
                  </div>
                </div>

                <div style={{ padding: '24px 0' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
                    <ActionBtn disabled>Include terms</ActionBtn>
                    <ActionBtn disabled>Mark terms as headings</ActionBtn>
                    <ActionBtn>Select all terms ({termTotal})</ActionBtn>
                  </div>
                  <div style={{ paddingTop: 12, fontSize: 13, color: C.g100, fontFamily: F }}>
                    Hint: Hover a term and hit space to include it or [H] to mark as heading. Click and drag to select many terms
                  </div>
                </div>

                {q && !hasExact && (
                  <button type="button" onClick={addTerm} style={{
                    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '8px 16px', borderRadius: 6,
                    background: C.g10, color: C.g160, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: F,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = C.g20; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = C.g10; }}
                  >
                    <svg viewBox="0 0 24 24" width={20} height={20}><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0a9 9 0 0 1 18 0" /></svg>
                    Add term &quot;{termQuery.trim()}&quot;
                  </button>
                )}

                {filteredTerms.length === 0 ? (
                  <div style={{ padding: '24px 4px', fontSize: 14, color: C.g80, fontFamily: F }}>No terms match &quot;{termQuery.trim()}&quot;.</div>
                ) : (
                  <div style={{ position: 'relative', paddingLeft: 16 }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: 'repeating-linear-gradient(0deg, transparent, transparent 4px, #57C99A 4px, #57C99A 5px)' }} />
                    <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                      {filteredTerms.map((t) => <TermChip key={t.text} term={t} />)}
                    </div>
                  </div>
                )}
              </div>

              {/* Topics & Questions */}
              <div ref={refs.topics} style={{ padding: 16, minHeight: '60vh' }}>
                <SectionHeader title="Topics & Questions">
                  Define your content draft by picking relevant topics and questions to answer.<br />
                  Ranksmile extracts them from the top-ranking pages and Google suggestions. <LearnMore />
                </SectionHeader>

                <div style={{ display: 'flex', alignItems: 'flex-end', borderBottom: `1px solid ${C.g20}`, marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
                    <TermTab label="All" count={336} active={topicsTab === 'all'} onClick={() => setTopicsTab('all')} />
                    <TermTab label="People Also Ask" count={4} active={topicsTab === 'paa'} onClick={() => setTopicsTab('paa')} />
                    <TermTab label="Competitors" count={332} active={topicsTab === 'comp'} onClick={() => setTopicsTab('comp')} />
                  </div>
                  <div style={{ flex: 1 }} />
                  <div style={{ paddingBottom: 10 }}><SearchIcon /></div>
                </div>

                <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: '100%', color: C.g140 }}>
                  <thead>
                    <tr style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 500, color: C.g100, borderBottom: `1px solid ${C.g20}` }}>
                      <th style={{ width: 16, padding: '8px 12px', textAlign: 'center' }}>
                        <span style={{ display: 'inline-flex', width: 20, height: 20, borderRadius: 4, background: C.purple, alignItems: 'center', justifyContent: 'center' }}>
                          <svg viewBox="0 0 20 20" width={16} height={16}><path fill="#fff" fillRule="evenodd" d="M4 10a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H4.75A.75.75 0 0 1 4 10" clipRule="evenodd" /></svg>
                        </span>
                      </th>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Topic</th>
                      <th style={{ width: 140, padding: '8px 12px', textAlign: 'left' }}>Source</th>
                      <th style={{ width: 16 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {TOPICS.map((t) => (
                      <tr key={t.topic} style={{ borderBottom: `1px solid ${C.g10}` }}>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}><Checkbox checked={t.checked} /></td>
                        <td style={{ padding: '8px 12px', fontSize: 14 }}>{t.topic}</td>
                        <td style={{ padding: '8px 12px' }}><SourceBadge source={t.source} /></td>
                        <td />
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Pagination */}
                <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0 6px', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {[1, 2, 3, 4, 5, 6, 7].map((p) => (
                      <button key={p} type="button" onClick={() => setPage(p)} style={{
                        width: 48, padding: '6px 16px', borderRadius: 6, fontSize: 14, fontWeight: 600, fontFamily: F, cursor: 'pointer', border: 'none',
                        background: page === p ? C.g160 : 'transparent', color: page === p ? '#fff' : C.g100,
                      }}
                      onMouseEnter={(e) => { if (page !== p) e.currentTarget.style.color = C.g120; }}
                      onMouseLeave={(e) => { if (page !== p) e.currentTarget.style.color = C.g100; }}
                      >{p}</button>
                    ))}
                    <span style={{ padding: '0 12px', display: 'inline-flex' }}><DotsIcon color={C.purple80} /></span>
                    <button type="button" onClick={() => setPage(42)} style={{ width: 48, padding: '6px 16px', borderRadius: 6, fontSize: 14, fontWeight: 600, fontFamily: F, cursor: 'pointer', border: 'none', background: page === 42 ? C.g160 : 'transparent', color: page === 42 ? '#fff' : C.g100 }}>42</button>
                    <button type="button" onClick={() => setPage((p) => Math.min(42, p + 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.g100, display: 'inline-flex', padding: 4 }}>
                      <svg viewBox="0 0 24 24" width={20} height={20}><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m8.25 4.5l7.5 7.5l-7.5 7.5" /></svg>
                    </button>
                  </div>
                </div>

                {/* Custom topic */}
                <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: '100%' }}>
                  <thead>
                    <tr style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 500, color: C.g100, borderBottom: `1px solid ${C.g20}` }}>
                      <th style={{ width: 16, padding: '8px 12px' }}><Checkbox checked={false} /></th>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Custom Topic</th>
                      <th style={{ width: 180, padding: '8px 12px', textAlign: 'left' }}>Source</th>
                      <th style={{ width: 32 }} />
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: '8px 12px' }}><Checkbox checked /></td>
                      <td style={{ padding: '8px 12px' }}>
                        <input placeholder="Create new topic..." style={{
                          width: '100%', minHeight: 40, padding: '0 12px', boxSizing: 'border-box', fontSize: 14, fontFamily: F,
                          background: 'transparent', border: 'none', outline: 'none', color: C.text,
                        }} />
                      </td>
                      <td />
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px',
              borderTop: `1px solid ${C.g20}`, background: '#fff', flexShrink: 0,
            }}>
              {/* Auto-save status (left) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 20 }}>
                {saveState === 'saving' && (
                  <>
                    <div style={{ width: 18, height: 18, border: `2px solid ${C.g20}`, borderTopColor: C.purple, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                    <span style={{ fontSize: 13, color: C.g80, fontFamily: F }}>Saving changes…</span>
                  </>
                )}
                {saveState === 'saved' && (
                  <>
                    <svg viewBox="0 0 24 24" width={18} height={18}><path fill={C.green} fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75s-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12m13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094z" clipRule="evenodd" /></svg>
                    <span style={{ fontSize: 13, color: C.g80, fontFamily: F }}>All changes saved</span>
                  </>
                )}
              </div>

              {/* Action (right) */}
              {saveState === 'saving' ? (
                <button type="button" disabled style={{
                  padding: '8px 24px', borderRadius: 8, fontSize: 16, fontWeight: 600, fontFamily: F,
                  background: C.g80, color: '#fff', border: 'none', cursor: 'default',
                }}>Saving…</button>
              ) : (
                <button type="button" onClick={onClose} style={{
                  padding: '8px 24px', borderRadius: 8, fontSize: 16, fontWeight: 600, fontFamily: F,
                  background: C.g160, color: '#fff', border: 'none', cursor: 'pointer', transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = C.purple; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = C.g160; }}
                >Let&apos;s go</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomizationPanelModal;
