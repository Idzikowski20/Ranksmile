import React from 'react';
import { BounceSmileyAnimation } from '../common/BounceSmileyAnimation';

const F = 'var(--font-family-primary)';

/** Brand mark — Smily logo + Ranksmile wordmark. */
const Brand = () => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
    <span style={{ width: 36, height: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <BounceSmileyAnimation compact size={36} entrance={false} />
    </span>
    <span style={{ fontWeight: 700, fontSize: 19, letterSpacing: '-0.01em', color: '#fafafa' }}>Ranksmile</span>
  </div>
);

/**
 * Split-screen auth shell: left = the (working) auth form, right = a brand panel
 * showing the product. Matches the app's dark shell rather than a light template,
 * so the working AuthView theme stays consistent.
 */
const AuthSplitLayout = ({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle: string }) => (
  <div className="auth-split" style={{ minHeight: '100dvh', display: 'grid', gridTemplateColumns: '1fr', background: '#0a0a0c', fontFamily: F }}>
    <style>{`
      .auth-aside { display: none; }
      @media (min-width: 920px) {
        .auth-split { grid-template-columns: 1.02fr 1fr; }
        .auth-aside { display: flex; }
      }
      @keyframes authIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
    `}</style>

    {/* Left — form */}
    <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', minHeight: '100dvh' }}>
      <div style={{ width: '100%', maxWidth: 392, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, animation: 'authIn 0.5s cubic-bezier(0.16,1,0.3,1)' }}>
        <Brand />
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: '#fafafa' }}>{title}</h1>
          <p style={{ margin: '8px 0 0', fontSize: 14.5, lineHeight: 1.5, color: '#8b8b93' }}>{subtitle}</p>
        </div>
        <div style={{ width: '100%' }}>{children}</div>
      </div>
    </main>

    {/* Right — brand panel */}
    <aside className="auth-aside" aria-hidden="true" style={{ position: 'relative', overflow: 'hidden', flexDirection: 'column', justifyContent: 'space-between', padding: 48, background: 'radial-gradient(120% 110% at 0% 0%, #0c2a44 0%, #0a1624 44%, #0a0a0c 100%)' }}>
      {/* faint grid texture */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)', backgroundSize: '46px 46px', maskImage: 'radial-gradient(80% 80% at 30% 20%, #000, transparent 75%)', WebkitMaskImage: 'radial-gradient(80% 80% at 30% 20%, #000, transparent 75%)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', maxWidth: 460 }}>
        <div style={{ width: 140, height: 160, marginBottom: 18 }}>
          <BounceSmileyAnimation entrance />
        </div>
        <h2 style={{ margin: 0, fontSize: 30, fontWeight: 700, lineHeight: 1.18, letterSpacing: '-0.02em', color: '#fafafa', textWrap: 'balance' as React.CSSProperties['textWrap'] }}>
          Optimize content while you write, not after.
        </h2>
        <p style={{ margin: '14px 0 0', fontSize: 15, lineHeight: 1.6, color: '#9ec9e8', maxWidth: '52ch' }}>
          Live content scoring, AI-search readiness, and reviewer comments in one editor — with Smily.
        </p>
      </div>

      {/* product mockup */}
      <div style={{ position: 'relative', marginTop: 36, borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.10)', boxShadow: '0 30px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(80,185,255,0.18), 0 0 60px rgba(80,185,255,0.18)', transform: 'rotate(-1.4deg)' }}>
        <img src="/article-viewer.png" alt="" style={{ display: 'block', width: '100%', height: 'auto' }} />
      </div>
    </aside>
  </div>
);

export default AuthSplitLayout;
