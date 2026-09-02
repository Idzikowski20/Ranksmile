import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Button, SegmentedControl, Separator } from '../koala/core';
import { Icon } from '../koala/icons/Icon';
import { BounceSmileyAnimation } from '../common/BounceSmileyAnimation';

const font = 'var(--font-family-primary)';
const DOCS_URL = 'https://ranksmile.pl';

/** The MCP endpoint served by this deployment — never a hardcoded host, so dev shows dev. */
const mcpUrl = (): string => (typeof window === 'undefined' ? '/mcp' : `${window.location.origin}/mcp`);

type Connection = { client_id: string; client_name: string | null; created_at: string | null };

type Tab = 'mcp' | 'api';

const LogoCircle = ({ children, overlap }: { children: React.ReactNode; overlap?: boolean }) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: '1px solid var(--koala-border-primary)',
      borderRadius: 9999,
      padding: 8,
      background: 'var(--koala-bg-primary)',
      marginLeft: overlap ? -8 : 0,
    }}
  >
    {children}
  </div>
);

/** Ranksmile smiley → dotted connector → the tools it links to. */
const LogoChain = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', alignItems: 'center' }}>
    <LogoCircle>
      <BounceSmileyAnimation compact size={20} entrance={false} animateRotate={false} />
    </LogoCircle>
    <div style={{ display: 'flex', alignItems: 'center', margin: '0 -6px', zIndex: 10 }}>
      <div style={{ width: 10, height: 10, borderRadius: 9999, background: 'var(--koala-border-primary)' }} />
      <div style={{ width: 12, height: 2, background: 'var(--koala-border-primary)' }} />
      <div style={{ width: 10, height: 10, borderRadius: 9999, background: 'var(--koala-border-primary)' }} />
    </div>
    <div style={{ display: 'flex', alignItems: 'center' }}>{children}</div>
  </div>
);

const ClaudeMark = () => (
  <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M3.14 10.637l3.146-1.765.053-.153-.053-.086h-.153l-.527-.032-1.798-.049-1.56-.065-1.51-.081-.38-.081L0 7.856l.037-.235.32-.214.457.04 1.014.069 1.518.105 1.101.065 1.634.17h.259l.036-.105-.089-.065-.069-.065-1.572-1.065-1.701-1.125-.89-.648-.483-.328-.243-.308-.105-.672.437-.481.587.04.15.041.595.457 1.272.984 1.66 1.222.244.203.097-.069.012-.048-.109-.183-.903-1.63-.964-1.66-.43-.688-.113-.413a1.984 1.984 0 01-.07-.489l.499-.675.275-.089.664.089.28.243.413.943.669 1.486 1.037 2.02.304.599.162.555.06.17h.106v-.098l.085-1.137.158-1.396.153-1.797.053-.506.25-.607.498-.328.39.187.32.457-.045.296-.19 1.234-.373 1.935-.243 1.295h.142l.162-.162.657-.87 1.101-1.377.487-.547.567-.603.365-.287h.688l.507.753-.227.777-.71.898-.587.761-.842 1.134-.527.907.049.073.125-.013 1.904-.405 1.028-.187 1.227-.21.556.259.06.263-.218.539-1.313.324-1.54.308-2.292.542-.028.02.033.04 1.033.098.44.024h1.081l2.013.15.527.348.316.425-.053.323-.81.413-1.094-.26-2.552-.606-.875-.219h-.121v.073l.728.712 1.336 1.207 1.673 1.553.085.385-.215.303-.226-.032-1.47-1.105-.567-.498-1.284-1.08h-.085v.113l.296.433 1.563 2.347.081.72-.113.235-.405.142-.446-.081-.916-1.284-.943-1.445-.762-1.295-.093.053-.45 4.836-.21.247-.485.187-.405-.308-.214-.498.214-.984.26-1.283.21-1.02.19-1.267.113-.421-.008-.028-.093.012-.956 1.311-1.454 1.964-1.15 1.23-.276.109-.478-.247.044-.441.267-.393 1.592-2.024.96-1.255.62-.724-.004-.105h-.037L2.755 12.373l-.753.097-.325-.304.04-.497.154-.162 1.272-.875-.398.004z"
      fill="#D97757"
    />
  </svg>
);

const OpenAIMark = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"
      fill="currentColor"
    />
  </svg>
);

const GeminiMark = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 2.25c.32 0 .6.204.7.507.44 1.35 1.19 2.58 2.19 3.6a8.99 8.99 0 0 0 3.6 2.19.737.737 0 0 1 0 1.406 8.99 8.99 0 0 0-3.6 2.19 8.99 8.99 0 0 0-2.19 3.6.737.737 0 0 1-1.406 0 8.99 8.99 0 0 0-2.19-3.6 8.99 8.99 0 0 0-3.6-2.19.737.737 0 0 1 0-1.406 8.99 8.99 0 0 0 3.6-2.19 8.99 8.99 0 0 0 2.19-3.6c.1-.303.38-.507.7-.507z"
      fill="#4285F4"
    />
  </svg>
);

const LookerMark = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M13.38 3.498c-.27 0-.511.19-.566.465L9.85 18.986a.578.578 0 0 0 .453.678l4.095.826a.58.58 0 0 0 .682-.455l2.963-15.021a.578.578 0 0 0-.453-.678l-4.096-.826a.589.589 0 0 0-.113-.012zm-5.876.098a.576.576 0 0 0-.516.318L.062 17.697a.575.575 0 0 0 .256.774l3.733 1.877a.578.578 0 0 0 .775-.258l6.926-13.781a.577.577 0 0 0-.256-.776L7.762 3.658a.571.571 0 0 0-.258-.062zm11.74.115a.576.576 0 0 0-.576.576v15.426c0 .318.258.578.576.578h4.178a.58.58 0 0 0 .578-.578V4.287a.578.578 0 0 0-.578-.576Z" fill="#2F73DA" />
  </svg>
);

const ZapierMark = () => (
  <svg width="20" height="20" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <path d="M10.5341 10.5374C9.54805 10.9084 8.44312 10.9091 7.45707 10.5376C7.08557 9.55265 7.08548 8.44795 7.4565 7.46285C8.44229 7.09117 9.54832 7.09111 10.5341 7.46279C10.9055 8.4476 10.9053 9.55256 10.5341 10.5374ZM16.1659 7.78889H11.9214L14.9226 4.78947C14.4516 4.12826 13.8701 3.54744 13.2085 3.07672L10.2071 6.07614V1.83438C9.40609 1.69972 8.58458 1.69992 7.78355 1.83438V6.07614L4.78218 3.07672C4.12074 3.54712 3.53908 4.12874 3.06804 4.78947L6.06964 7.78889H1.82518C1.72041 8.61341 1.68637 9.38829 1.82518 10.2111H6.06969L3.0681 13.2105C3.54027 13.8727 4.11957 14.4516 4.78218 14.9235L7.78355 11.9239V16.1658C8.58467 16.3 9.40595 16.3001 10.2071 16.1658V11.9239L13.2087 14.9235C13.8706 14.4523 14.4511 13.872 14.9226 13.2105L11.921 10.2111H16.1659C16.3006 9.41129 16.3006 8.58871 16.1659 7.78889Z" fill="#FF4A00" />
  </svg>
);

const GoogleMark = () => (
  <svg width="20" height="20" viewBox="-56.13 0 298.85 298.85" fill="none" aria-hidden="true">
    <path d="M92.3,0c-14.97,0-26.19,11.22-26.19,26.19,0,4.99,1.25,9.98,4.99,14.97l11.22-11.22v-3.74c0-6.24,4.99-11.22,11.22-11.22s11.22,4.99,11.22,11.22-4.99,11.22-11.22,11.22h-3.74l-11.22,9.98c12.47,7.48,28.7,4.99,36.17-7.48,7.48-12.47,4.99-28.7-7.48-36.17C103.53,1.27,98.54.02,92.3.02v-.02Z" fill="#AECBFA" />
    <path d="M82.32,76.09c0-8.73-2.49-17.46-7.48-24.94l-14.97,14.97c1.25,3.74,2.49,6.24,2.49,9.98,0,6.24-2.49,11.22-6.24,14.97l7.48,19.97c12.47-7.48,18.71-21.2,18.71-34.92l.02-.03Z" fill="#5E97F6" />
    <path d="M42.4,97.29c-11.22,0-21.2-8.73-21.2-19.97s8.73-21.2,19.97-21.2c3.74,0,8.73,1.25,12.47,3.74l14.97-13.72c-8.73-7.48-17.46-11.22-27.44-11.22C18.71,34.92,0,53.64,0,76.09s17.46,41.17,41.17,41.17c2.49,0,6.24,0,8.73-1.25l-7.48-18.71h-.02Z" fill="#5E97F6" />
    <path d="M93.55,113.5c-8.73,0-17.46,1.25-26.19,3.74l11.22,27.44c4.99,0,9.98-1.25,14.97-1.25,34.92,0,62.37,28.7,62.37,62.37s-28.7,62.37-62.37,62.37-62.37-28.7-62.37-62.37c0-23.71,12.47-44.91,33.67-54.89l-11.22-27.44C7.48,145.93-11.22,202.06,11.22,246.96c22.45,46.16,78.58,64.85,123.48,42.4,46.16-22.45,64.85-78.58,42.4-123.48-16.21-31.18-48.64-52.38-83.57-52.38h.02Z" fill="#4285F4" />
  </svg>
);

const Intro = ({ chain, title, subtitle }: { chain: React.ReactNode; title: string; subtitle: string }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <LogoChain>{chain}</LogoChain>
    <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5 }}>
      <span style={{ fontWeight: 600, color: 'var(--koala-text-primary)' }}>{title}</span>
      <span style={{ display: 'block', fontWeight: 600, color: 'var(--koala-text-tertiary)', marginTop: 4 }}>{subtitle}</span>
    </p>
  </div>
);

const cardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  width: '100%',
  border: '1px solid var(--koala-border-primary)',
  borderRadius: 16,
  padding: 24,
  background: 'var(--koala-bg-primary)',
};

/** Agents that completed the consent flow, with a way to cut them off again. */
const ConnectedAgents = () => {
  const [items, setItems] = useState<Connection[] | null>(null);

  const load = async () => {
    try {
      const res = await fetch('/api/mcp/connections', { credentials: 'same-origin' });
      const body = (await res.json()) as { connections?: Connection[] };
      setItems(res.ok ? body.connections ?? [] : []);
    } catch {
      setItems([]);
    }
  };

  React.useEffect(() => { void load(); }, []);

  const revoke = async (clientId: string) => {
    try {
      const res = await fetch(`/api/mcp/connections?client_id=${encodeURIComponent(clientId)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error('failed');
      toast.success('Dostęp cofnięty');
      await load();
    } catch {
      toast.error('Nie udało się cofnąć dostępu');
    }
  };

  if (items === null || items.length === 0) return null;

  return (
    <div style={cardStyle}>
      <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--koala-text-primary)' }}>Połączone agenty</div>
      {items.map((c) => (
        <div key={c.client_id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <div style={{ fontSize: 14, color: 'var(--koala-text-primary)' }}>{c.client_name || c.client_id}</div>
            {c.created_at ? (
              <div style={{ fontSize: 13, color: 'var(--koala-text-tertiary)' }}>
                Połączono {new Date(c.created_at).toLocaleDateString('pl-PL')}
              </div>
            ) : null}
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => revoke(c.client_id)}>
            Cofnij dostęp
          </Button>
        </div>
      ))}
    </div>
  );
};

const McpTab = () => {
  const url = mcpUrl();
  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Skopiowano adres do schowka');
    } catch {
      toast.error('Nie udało się skopiować');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
      <Intro
        chain={
          <>
            <LogoCircle><ClaudeMark /></LogoCircle>
            <LogoCircle overlap><OpenAIMark /></LogoCircle>
            <LogoCircle overlap><GeminiMark /></LogoCircle>
          </>
        }
        title="Połącz się z Claude, Codex lub dowolnym wybranym agentem."
        subtitle="Automatyzuj pracę, pracuj w skali i analizuj dane bez otwierania aplikacji Ranksmile."
      />

      <div style={cardStyle}>
        <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--koala-text-primary)' }}>Połącz z MCP Ranksmile</div>
        <div style={{ display: 'flex', gap: 12, width: '100%', alignItems: 'center' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flex: '1 1 auto',
              minWidth: 0,
              height: 36,
              padding: '0 12px',
              borderRadius: 8,
              background: 'var(--koala-bg-secondary)',
              fontFamily: 'var(--font-family-mono, monospace)',
              fontSize: 14,
              color: 'var(--koala-text-primary)',
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</span>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={copyUrl}
            aria-label="Skopiuj adres MCP"
            icon={<Icon name="Copy" size={18} weight="regular" />}
          />
        </div>
        <div style={{ fontSize: 14, color: 'var(--koala-text-tertiary)' }}>
          Skopiuj ten adres i wklej go w konfiguracji MCP swojego agenta. Przy pierwszym połączeniu
          zobaczysz ekran zgody — dostęp jest tylko do odczytu.
        </div>
      </div>

      <ConnectedAgents />
    </div>
  );
};

const ApiTab = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
    <Intro
      chain={
        <>
          <LogoCircle><LookerMark /></LogoCircle>
          <LogoCircle overlap><ZapierMark /></LogoCircle>
          <LogoCircle overlap><GoogleMark /></LogoCircle>
        </>
      }
      title="Połącz się z Zapier, Looker Studio lub wybranym systemem CMS."
      subtitle="Automatyzuj pracę, pracuj w skali i analizuj dane bez otwierania aplikacji Ranksmile."
    />

    <div style={cardStyle}>
      <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--koala-text-primary)' }}>Dostęp do API nie jest dostępny w Twoim planie</div>
      <div style={{ fontSize: 14, color: 'var(--koala-text-secondary)', lineHeight: 1.45 }}>
        Przejdź na wyższy plan, aby odblokować dostęp do API i zintegrować Ranksmile z czym chcesz.
      </div>
      <div>
        <Button type="button" variant="primary" onClick={() => toast.success('Zmiana planu — już wkrótce!')}>
          Przejdź na wyższy plan
        </Button>
      </div>
    </div>

    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--koala-text-primary)' }}>Dokumentacja</div>
      <div style={{ fontSize: 14, color: 'var(--koala-text-tertiary)' }}>Przykłady, rozwiązywanie problemów, FAQ</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button variant="secondary" size="sm" onClick={() => window.open(DOCS_URL, '_blank', 'noopener')}>Przegląd</Button>
        <Button variant="secondary" size="sm" onClick={() => window.open(DOCS_URL, '_blank', 'noopener')}>Dokumentacja API</Button>
        <Button variant="secondary" size="sm" onClick={() => window.open(DOCS_URL, '_blank', 'noopener')}>Dokumentacja dla LLMów</Button>
      </div>
    </div>
  </div>
);

const McpApiSettings = () => {
  const [tab, setTab] = useState<Tab>('mcp');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: font, width: '100%', maxWidth: 880 }}>
      <Separator />
      <SegmentedControl<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'mcp', label: 'MCP' },
          { value: 'api', label: 'API' },
        ]}
      />
      {tab === 'mcp' ? <McpTab /> : <ApiTab />}
    </div>
  );
};

export default McpApiSettings;
