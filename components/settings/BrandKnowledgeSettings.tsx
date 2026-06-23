import React, { useState } from 'react';
import toast from 'react-hot-toast';

const font = 'var(--font-family-primary)';

const KNOWLEDGE: { h: string; body: string }[] = [
  { h: 'Business Type', body: 'Ecommerce / Agencja usług internetowych (B2B)' },
  { h: 'Industry', body: 'Technologie cyfrowe / Usługi internetowe / Marketing cyfrowy' },
  {
    h: 'Products/Services description',
    body: 'Tworzenie nowoczesnych stron internetowych, sklepów internetowych, aplikacji webowych oraz skuteczne pozycjonowanie SEO. Kompleksowa obsługa firm – od projektu po rozwój i optymalizację. (Oferta obejmuje projektowanie, wdrażanie i utrzymanie rozwiązań cyfrowych dla biznesu) dokładnie: "Nowoczesne strony internetowe, sklepy internetowe, aplikacje webowe i skuteczne pozycjonowanie SEO. Kompleksowa obsługa firm – od projektu po rozwój i optymalizację."',
  },
  {
    h: 'Customer profile',
    body: 'Firmy małe i średnie, które potrzebują profesjonalnej strony lub sklepu internetowego oraz chcą zwiększyć widoczność online przez SEO – szczególnie przedsiębiorcy, usługodawcy i handlowcy, którzy chcą rozwijać lub przenieść swój biznes do internetu',
  },
  {
    h: 'Competitors',
    body: 'Agencje SEO, firmy tworzące strony internetowe, sklepy online; przykładowo: Pixtech, iziCMS, agencja marketingowa cyfrowa lokalna',
  },
  {
    h: 'Topics to cover',
    body: 'strony internetowe, sklepy internetowe, aplikacje webowe, pozycjonowanie SEO, optymalizacja serwisów, rozwój i utrzymanie stron',
  },
];

// ─── Ribbon icons (Phosphor, 256 viewBox) ─────────────────────────────────────

const IconBold = () => (
  <svg viewBox="0 0 256 256" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M170.5 115.7A44 44 0 0 0 140 40H64a7.9 7.9 0 0 0-8 8v152a8 8 0 0 0 8 8h88a48 48 0 0 0 18.5-92.3ZM72 56h68a28 28 0 0 1 0 56H72Zm80 136H72v-64h80a32 32 0 0 1 0 64Z" /></svg>
);
const IconItalic = () => (
  <svg viewBox="0 0 256 256" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M200 56a8 8 0 0 1-8 8h-34.23L115.1 192H144a8 8 0 0 1 0 16H64a8 8 0 0 1 0-16h34.23L140.9 64H112a8 8 0 0 1 0-16h80a8 8 0 0 1 8 8" /></svg>
);
const IconList = () => (
  <svg viewBox="0 0 256 256" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M224 128a8 8 0 0 1-8 8H104a8 8 0 0 1 0-16h112a8 8 0 0 1 8 8M104 72h112a8 8 0 0 0 0-16H104a8 8 0 0 0 0 16m112 112H104a8 8 0 0 0 0 16h112a8 8 0 0 0 0-16M43.58 55.16L48 52.94V104a8 8 0 0 0 16 0V40a8 8 0 0 0-11.58-7.16l-16 8a8 8 0 0 0 7.16 14.32m36.19 101.56a23.73 23.73 0 0 0-9.6-15.95a24.86 24.86 0 0 0-34.11 4.7a23.6 23.6 0 0 0-3.57 6.46a8 8 0 1 0 15 5.47a7.8 7.8 0 0 1 1.18-2.13a8.76 8.76 0 0 1 12-1.59a7.9 7.9 0 0 1 3.26 5.32a7.64 7.64 0 0 1-1.57 5.78a1 1 0 0 0-.08.11l-28.69 38.32A8 8 0 0 0 40 216h32a8 8 0 0 0 0-16H56l19.08-25.53a23.47 23.47 0 0 0 4.69-17.75" /></svg>
);
const Chevron = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m19.5 8.25l-7.5 7.5l-7.5-7.5" /></svg>
);

const RibbonBtn = ({ children, chip }: { children: React.ReactNode; chip?: boolean }) => {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        height: 28,
        minWidth: 28,
        padding: chip ? '0 6px' : 0,
        justifyContent: 'center',
        border: 'none',
        borderRadius: 4,
        cursor: 'pointer',
        color: '#18181B',
        background: chip ? (hover ? '#F4F4F5' : '#F8F8F9') : (hover ? '#F4F4F5' : 'transparent'),
        transition: 'background 200ms ease',
      }}
    >
      {children}
    </button>
  );
};

const Divider = () => (
  <span style={{ display: 'flex', alignItems: 'center', padding: '0 4px' }}>
    <span style={{ width: 1, height: 20, background: '#E4E4E7' }} />
  </span>
);

// ─── Brand name input ─────────────────────────────────────────────────────────

const BrandNameInput = () => {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type="text"
      name="name"
      defaultValue="IDZTECH"
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: 256,
        maxWidth: '100%',
        boxSizing: 'border-box',
        height: 36,
        padding: '0 12px',
        fontFamily: font,
        fontSize: 13,
        color: '#18181B',
        borderRadius: 8,
        border: `1px solid ${focused ? '#AA93FD' : '#E4E4E7'}`,
        boxShadow: focused ? '0 0 0 3px rgba(120,58,251,0.1)' : '0px 1px 2px 0px rgba(26,29,40,0.06)',
        outline: 'none',
      }}
    />
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const BrandKnowledgeSettings = () => (
  <form
    onSubmit={(e) => { e.preventDefault(); toast.success('Brand Knowledge saved'); }}
    style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 16, width: '100%', fontFamily: font }}
  >
    {/* Brand name */}
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <label style={{ fontSize: 14, fontWeight: 500, color: '#3F3F47', paddingBottom: 6 }}>Brand name</label>
      <BrandNameInput />
    </div>

    {/* Knowledge editor */}
    <label style={{ fontSize: 14, fontWeight: 500, color: '#3F3F47' }}>Knowledge</label>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '55vh', width: '100%', overflow: 'hidden', borderRadius: 8, border: '1px solid #E4E4E7' }}>
        {/* Ribbon */}
        <div style={{ background: '#fff', padding: '16px 24px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <RibbonBtn chip>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#630DE3' }}>Aa</span>
              <span style={{ color: '#18181B', display: 'inline-flex' }}><Chevron /></span>
            </RibbonBtn>
            <Divider />
            <RibbonBtn><IconBold /></RibbonBtn>
            <RibbonBtn><IconItalic /></RibbonBtn>
            <Divider />
            <RibbonBtn>
              <IconList />
              <Chevron />
            </RibbonBtn>
          </div>
        </div>

        {/* Editable content */}
        <div style={{ display: 'flex', width: '100%', overflow: 'auto', background: '#fff' }}>
          <div style={{ width: '100%', padding: '0 16px' }}>
            <div
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              translate="no"
              style={{ outline: 'none', margin: '16px 0 0', padding: '0 12px 12px', fontSize: 16, lineHeight: 1.75, color: '#18181B', minHeight: 200 }}
            >
              {KNOWLEDGE.map((s) => (
                <React.Fragment key={s.h}>
                  <p style={{ margin: '0 0 16px' }}><strong>{s.h}</strong></p>
                  <p style={{ margin: '0 0 16px' }}>{s.body}</p>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Save */}
    <SaveButton />
  </form>
);

const SaveButton = () => {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="submit"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 12,
        width: 'fit-content',
        padding: '8px 24px',
        borderRadius: 8,
        border: 'none',
        cursor: 'pointer',
        fontFamily: font,
        fontSize: 16,
        fontWeight: 600,
        color: '#fff',
        background: hover ? '#783AFB' : '#18181B',
        transition: 'background 150ms ease',
      }}
    >
      Save
    </button>
  );
};

export default BrandKnowledgeSettings;
