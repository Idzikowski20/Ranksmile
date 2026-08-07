import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import React, { useEffect, useState } from 'react';
import { BounceSmileyAnimation } from '../../components/common/BounceSmileyAnimation';
import Button from '../../components/koala/primitives/Button';
import { Icon } from '../../components/koala/icons';
import DomainFaviconAvatar from '../../components/common/DomainFaviconAvatar';
import { semantic } from '../../components/koala/tokens';
import {
  AUTH_FONT,
  authErrorStyle,
  authFullWidthBtnStyle,
  authPageStyle,
  authSubtitleStyle,
  authTitleStyle,
} from '../../components/auth/authStyles';
import { authClient } from '../../lib/auth/client';
import { useWorkspaces } from '../../services/workspaces';
import { useOrganization } from '../../services/organization';

const COLUMN_W = 384;

const BrandMark = () => (
  <div
    className="wp-connect-brand"
    style={{
      position: 'absolute',
      top: 48,
      left: 48,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 10,
      zIndex: 2,
    }}
  >
    <BounceSmileyAnimation compact size={32} entrance={false} animateRotate={false} />
    <span
      style={{
        fontFamily: AUTH_FONT,
        fontWeight: 700,
        fontSize: 20,
        letterSpacing: '-0.5px',
        color: semantic.text.primary,
        lineHeight: 1,
      }}
    >
      Ranksmile
    </span>
  </div>
);

const StepBadge = ({ children }: { children: React.ReactNode }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2px 6px',
      borderRadius: 8,
      border: `1px solid ${semantic.border.primary}`,
      background: semantic.background.primary,
      boxShadow: '0px 1px 1px rgba(0,0,0,0.04)',
      fontFamily: AUTH_FONT,
      fontSize: 14,
      fontWeight: 500,
      lineHeight: '20px',
      letterSpacing: '-0.4px',
      color: semantic.text.secondary,
    }}
  >
    {children}
  </span>
);

const IconRing = ({ name }: { name: string }) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 12,
      borderRadius: 9999,
      border: `2px solid ${semantic.border.brand}`,
      boxShadow: '0 0 0 2px color-mix(in srgb, var(--koala-text-brand) 10%, transparent)',
      background: semantic.background.primary,
    }}
    aria-hidden
  >
    <Icon name={name} size={32} color={semantic.text.primary} />
  </div>
);

type WorkspaceOptionProps = {
  name: string;
  domain?: string | null;
  description?: string;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
};

const WorkspaceOption = ({ name, domain, description, selected, onSelect, disabled }: WorkspaceOptionProps) => (
  <label
    style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 8,
      width: '100%',
      boxSizing: 'border-box',
      padding: 16,
      borderRadius: 16,
      background: semantic.background.primary,
      cursor: disabled ? 'var(--koala-cursor-not-allowed)' : 'var(--koala-cursor-pointing)',
      border: selected
        ? `1.5px solid ${semantic.border.brand}`
        : `1px solid ${semantic.border.primary}`,
      boxShadow: selected
        ? '0 0 0 3px color-mix(in srgb, var(--koala-text-brand) 10%, transparent)'
        : 'none',
      transition: 'border-color 120ms ease, box-shadow 120ms ease',
      opacity: disabled ? 0.6 : 1,
    }}
  >
    <input
      type="radio"
      name="workspace"
      checked={selected}
      onChange={onSelect}
      disabled={disabled}
      style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
    />
    <span style={{ display: 'inline-flex', flexShrink: 0, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }} aria-hidden>
      <DomainFaviconAvatar domain={domain} size={20} plain />
    </span>
    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span
        style={{
          fontFamily: AUTH_FONT,
          fontSize: 16,
          fontWeight: 600,
          lineHeight: '24px',
          letterSpacing: '-0.25px',
          color: semantic.text.primary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {name}
      </span>
      {description ? (
        <span
          style={{
            fontFamily: AUTH_FONT,
            fontSize: 14,
            fontWeight: 400,
            lineHeight: '20px',
            letterSpacing: '-0.4px',
            color: semantic.text.secondary,
          }}
        >
          {description}
        </span>
      ) : null}
    </span>
    <span
      aria-hidden
      style={{
        width: 16,
        height: 16,
        flexShrink: 0,
        marginTop: 4,
        borderRadius: 9999,
        boxSizing: 'border-box',
        border: selected ? `5px solid ${semantic.border.brand}` : `1.5px solid ${semantic.border.primary}`,
        background: semantic.background.primary,
        transition: 'border 120ms ease',
      }}
    />
  </label>
);

const Column = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      width: '100%',
      maxWidth: COLUMN_W,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 32,
    }}
  >
    {children}
  </div>
);

const Heading = ({ title, subtitle }: { title: string; subtitle: React.ReactNode }) => (
  <div style={{ textAlign: 'center', width: '100%', maxWidth: COLUMN_W }}>
    <h1 style={authTitleStyle}>{title}</h1>
    <p style={authSubtitleStyle}>{subtitle}</p>
  </div>
);

/** Landing the WP plugin opens (?token=&url=) to authorise a WordPress connection. */
const WordPressConnect: NextPage = () => {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const session = authClient.useSession?.();
  const email = mounted ? (session?.data?.user?.email ?? '') : '';
  const { data: wsData } = useWorkspaces();
  const { data: org } = useOrganization();

  const token = mounted ? (router.query.token as string | undefined) : undefined;
  const siteUrl = mounted ? (router.query.url as string | undefined) : undefined;

  const workspaces = wsData?.workspaces || [];
  const [workspaceId, setWorkspaceId] = useState<number | null>(null);
  useEffect(() => {
    if (workspaceId == null && workspaces.length) setWorkspaceId(wsData?.activeId ?? workspaces[0].id);
  }, [workspaces, wsData, workspaceId]);

  const [state, setState] = useState<'idle' | 'connecting' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const connect = async () => {
    if (!token || !siteUrl || !workspaceId) return;
    setState('connecting');
    setErrorMsg('');
    try {
      const res = await fetch('/api/wordpress/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, siteUrl, workspaceId, orgName: org?.name || '' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.connected) {
        setErrorMsg(typeof data?.error === 'string' ? data.error : 'Connection failed.');
        setState('error');
        return;
      }
      setState('done');
    } catch {
      setErrorMsg('Connection failed.');
      setState('error');
    }
  };

  const renderBody = () => {
    if (!token || !siteUrl) {
      return (
        <Column>
          <IconRing name="WarningCircle" />
          <Heading
            title="Connect your WordPress site"
            subtitle="This page is opened from the Ranksmile plugin in WordPress. We couldn’t find a connection token — start again from WordPress (Ranksmile → Connect)."
          />
        </Column>
      );
    }

    if (!email) {
      return (
        <Column>
          <StepBadge>WordPress</StepBadge>
          <Heading
            title="Connect your WordPress site"
            subtitle={
              <>
                Sign in to connect{' '}
                <span style={{ color: semantic.text.primary, fontWeight: 500 }}>{siteUrl}</span> to
                your account.
              </>
            }
          />
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Button
              variant="primary"
              size="lg"
              style={{ ...authFullWidthBtnStyle, borderRadius: 14 }}
              onClick={() => {
                void router.push(`/auth/sign-in?next=${encodeURIComponent(router.asPath)}`);
              }}
            >
              Sign in
            </Button>
          </div>
        </Column>
      );
    }

    if (state === 'done') {
      return (
        <Column>
          <IconRing name="HandPeace" />
          <Heading
            title="You're all set"
            subtitle={
              <>
                <span style={{ color: semantic.text.primary, fontWeight: 500 }}>{siteUrl}</span> is
                connected to Ranksmile. You can safely close this window and return to WordPress.
              </>
            }
          />
        </Column>
      );
    }

    const busy = state === 'connecting';
    const disabled = busy || !workspaceId || workspaces.length === 0;

    return (
      <Column>
        <StepBadge>WordPress</StepBadge>
        <Heading
          title="Choose workspace"
          subtitle={
            <>
              Hi {email}. Pick the workspace to connect{' '}
              <span style={{ color: semantic.text.primary, fontWeight: 500 }}>{siteUrl}</span> to.
            </>
          }
        />

        <div
          role="radiogroup"
          aria-label="Workspace"
          style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}
        >
          {workspaces.length === 0 ? (
            <p style={{ ...authSubtitleStyle, margin: 0 }}>
              No workspaces yet. Create one in the app, then return here.
            </p>
          ) : (
            workspaces.map((w) => (
              <WorkspaceOption
                key={w.id}
                name={w.name}
                domain={w.domain}
                description={w.domain ? w.domain : 'Connect this WordPress site here'}
                selected={workspaceId === w.id}
                onSelect={() => setWorkspaceId(w.id)}
                disabled={busy}
              />
            ))
          )}
        </div>

        {state === 'error' && errorMsg ? (
          <p style={{ ...authErrorStyle, margin: 0, width: '100%' }}>{errorMsg}</p>
        ) : null}

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Button
            variant="primary"
            size="lg"
            style={{ ...authFullWidthBtnStyle, borderRadius: 14 }}
            onClick={connect}
            disabled={disabled}
            busy={busy}
          >
            {busy ? 'Connecting…' : 'Connect'}
          </Button>
        </div>
      </Column>
    );
  };

  return (
    <div style={{ ...authPageStyle, fontFamily: AUTH_FONT, position: 'relative' }}>
      <Head>
        <title>Connect WordPress — Ranksmile</title>
      </Head>
      <BrandMark />
      <style>{`
        @media (max-width: 640px) {
          .wp-connect-brand { top: 24px !important; left: 24px !important; }
        }
      `}</style>
      <main
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '96px 16px 48px',
          overflowY: 'auto',
        }}
      >
        {renderBody()}
      </main>
    </div>
  );
};

export default WordPressConnect;
