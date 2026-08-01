/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from 'react-query';
import { authClient } from '../../../lib/auth/client';
import { useProfile } from '../../../services/profile';
import { useGscAccount } from '../../../services/gscAccount';
import { useOnboardingChecklist, type OnboardingStep } from '../../../lib/useOnboardingChecklist';
import fetchJson from '../../../lib/fetchJson';
import type { PlanLimitMetric, PlanSummaryData } from '../../../lib/planLimits';
import { formatMetricUsage } from '../../../lib/planLimits';
import { levelCss } from '../../../lib/serviceStatus';
import { useServiceStatus } from '../../../services/serviceStatus';
import { Avatar } from '../../core/avatar';
import {
  IconCreditCard, IconFire, IconBroadcast, IconEllipsis, IconChevron,
  IconQuestion, IconGroup, IconSentryLogo, IconDocs, IconSupport,
  IconBuilding, IconMegaphone, IconGlobe,
} from './sentryIcons';

type Placement = 'rail' | 'mobile';

type Props = {
  /** Vertical pill in desktop rail; horizontal row in mobile sidebar. */
  orientation?: 'vertical' | 'horizontal';
  placement?: Placement;
};

type PlanSummaryResponse = {
  summary: PlanSummaryData;
  statusLine: string;
};

const PLAN_SUMMARY_FALLBACK: PlanSummaryResponse = {
  summary: {
    planSlug: 'starter',
    planName: 'Starter',
    billingPeriod: null,
    subscriptionStatus: null,
    trialEndsAt: null,
    currentPeriodEnd: null,
    metrics: [],
    overallPct: 0,
  },
  statusLine: '',
};

const NavProgressRing = ({ pct }: { pct: number }) => {
  const r = 8;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);
  return (
    <svg className="sentry-nav-ring" role="img" height="20" width="20" aria-hidden="true">
      <circle r={r} cx="10" cy="10" fill="none" strokeWidth="2" stroke="rgba(255,255,255,0.15)" />
      <circle
        r={r} cx="10" cy="10" fill="none" strokeWidth="2" strokeLinecap="round"
        stroke="#F29964" strokeDasharray={c} strokeDashoffset={offset}
        transform="rotate(-90 10 10)"
      />
      <text x="10" y="10" textAnchor="middle" dominantBaseline="central">{Math.round(pct)}</text>
    </svg>
  );
};

const useDismiss = (onClose: () => void) => {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  return ref;
};

const useLocalStorage = <T, >(key: string, defaultValue: T): [T, (v: T | ((prev: T) => T)) => void] => {
  const [value, setValue] = useState<T>(defaultValue);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored) setValue(JSON.parse(stored) as T);
    } catch { /* ignore */ }
    setHydrated(true);
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  }, [key, value, hydrated]);

  return [value, setValue];
};

function popoverStyle(anchor: DOMRect, placement: Placement): React.CSSProperties {
  if (placement === 'mobile') {
    return {
      left: 12,
      right: 12,
      bottom: Math.max(12, window.innerHeight - anchor.top + 8),
      top: 'auto',
      width: 'auto',
      maxWidth: 'min(420px, calc(100vw - 24px))',
    };
  }
  return { left: anchor.right + 8, bottom: 12, top: 'auto' };
}

type MenuLinkProps = {
  icon: React.ReactNode;
  label: React.ReactNode;
  href?: string;
  chevron?: boolean;
  trailing?: React.ReactNode;
  onClick?: () => void;
  expanded?: boolean;
};

const MenuLink = ({ icon, label, href, chevron, trailing, onClick, expanded }: MenuLinkProps) => {
  const body = (
    <>
      {icon}
      <span className="sentry-menu-item-label">{label}</span>
      {trailing}
      {chevron && <span className="sentry-menu-chevron"><IconChevron rotate={90} /></span>}
    </>
  );
  if (href) {
    const external = /^https?:\/\//i.test(href);
    if (external) {
      return (
        <a className="sentry-menu-item" href={href} target="_blank" rel="noreferrer noopener" onClick={onClick}>
          {body}
        </a>
      );
    }
    return (
      <Link className="sentry-menu-item" href={href} prefetch={false} onClick={onClick}>
        {body}
      </Link>
    );
  }
  return <button type="button" className="sentry-menu-item" onClick={onClick} aria-expanded={expanded}>{body}</button>;
};

type SubItem = { icon: React.ReactNode; label: string; href?: string };
const HELP_SUBMENUS: Record<string, SubItem[]> = {
  Resources: [
    { icon: <IconSentryLogo />, label: 'Dashboard', href: '/dashboard' },
    { icon: <IconDocs />, label: 'Onboarding', href: '/onboarding' },
    { icon: <IconQuestion />, label: 'Settings', href: '/settings' },
    { icon: <IconSupport />, label: 'Billing', href: '/plans' },
  ],
  Community: [
    { icon: <IconGroup />, label: 'Workspaces', href: '/domains' },
  ],
  Legal: [
    { icon: <IconBuilding />, label: 'Terms of Service', href: '/legal/terms' },
    { icon: <IconBuilding />, label: 'Privacy Policy', href: '/legal/privacy' },
    { icon: <IconBuilding />, label: 'Cookie Policy', href: '/legal/cookies' },
  ],
};

const HelpMenu = ({ anchor, onClose, placement }: { anchor: DOMRect; onClose: () => void; placement: Placement }) => {
  const ref = useDismiss(onClose);
  const [sub, setSub] = useState<string | null>(null);
  return (
    <div ref={ref} className="sentry-nav-popover" style={popoverStyle(anchor, placement)} onMouseLeave={() => setSub(null)}>
      <ul className="sentry-menu-list">
        {(['Resources', 'Community', 'Legal'] as const).map((key) => (
          <li key={key} className="sentry-menu-subwrap" onMouseEnter={() => setSub(key)}>
            <MenuLink
              icon={key === 'Resources' ? <IconQuestion /> : key === 'Community' ? <IconGroup /> : <IconBuilding />}
              label={key}
              chevron
              expanded={sub === key}
            />
            {sub === key && (
              <div className="sentry-nav-popover sentry-menu-flyout">
                <ul className="sentry-menu-list">
                  {HELP_SUBMENUS[key].map((it) => (
                    <li key={it.label}><MenuLink icon={it.icon} label={it.label} href={it.href} /></li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        ))}
      </ul>
      <hr className="sentry-menu-sep" />
      <ul className="sentry-menu-list">
        <li><MenuLink icon={<IconMegaphone />} label="Give feedback" href="https://ranksmile.pl" /></li>
        <li><MenuLink icon={<IconGlobe />} label="Tour the new navigation" href="https://ranksmile.pl" /></li>
      </ul>
    </div>
  );
};

type ChangelogEntry = { title: string; body: string; href: string; image?: string };
const CHANGELOG: ChangelogEntry[] = [
  {
    title: 'Redesigned navigation',
    body: 'A new sidebar with dockable secondary panels, workspace switcher, and quicker access to SEO and AI Visibility tools.',
    href: 'https://ranksmile.pl',
  },
  {
    title: 'AI Visibility tracking',
    body: 'Monitor how AI search engines mention your brand, track competitors, and discover new content opportunities.',
    href: 'https://ranksmile.pl',
  },
  {
    title: 'Content recommendations',
    body: 'Automated content audits surface pages that need optimization and ideas for new content to create.',
    href: 'https://ranksmile.pl',
  },
];

const WhatsNewMenu = ({ anchor, onClose, placement }: { anchor: DOMRect; onClose: () => void; placement: Placement }) => {
  const ref = useDismiss(onClose);
  return (
    <div ref={ref} className="sentry-nav-popover sentry-nav-popover--wide" style={popoverStyle(anchor, placement)}>
      <ul className="sentry-whatsnew-list">
        {CHANGELOG.map((c) => (
          <li key={c.href} className="sentry-whatsnew-item">
            <div className="sentry-whatsnew-head">
              <a className="sentry-whatsnew-title" href={c.href} target="_blank" rel="noreferrer noopener">{c.title}</a>
              <span className="sentry-whatsnew-tag">New Feature</span>
            </div>
            <p className="sentry-whatsnew-body">
              {c.body}
              <a className="sentry-whatsnew-readmore" href={c.href} target="_blank" rel="noreferrer noopener">Read more</a>
            </p>
            {c.image && <img className="sentry-whatsnew-img" loading="lazy" alt={c.title} src={c.image} />}
          </li>
        ))}
      </ul>
    </div>
  );
};

const ServiceStatusMenu = ({ anchor, onClose, placement }: { anchor: DOMRect; onClose: () => void; placement: Placement }) => {
  const ref = useDismiss(onClose);
  const { data, isLoading } = useServiceStatus();
  const overall = data?.overall ?? 'ok';
  const tone = levelCss(overall);

  return (
    <div ref={ref} className="sentry-nav-popover sentry-nav-popover--wide" style={popoverStyle(anchor, placement)}>
      <div className="sentry-status-title">{isLoading ? 'Checking status…' : (data?.title ?? 'All systems operational')}</div>
      <ul className="sentry-status-list">
        {(data?.services ?? []).map((s) => {
          const css = levelCss(s.level);
          return (
            <li key={s.id} className="sentry-status-update">
              <div className="sentry-status-head">
                <span className={`sentry-status-dot sentry-status-dot--${css}`} />
                <span className={`sentry-status-label sentry-status-label--${css}`}>{s.name}</span>
                <span className="sentry-status-time">({s.label})</span>
              </div>
              <p className="sentry-status-msg">{s.msg}</p>
            </li>
          );
        })}
        {!isLoading && !data?.services.length && (
          <li className="sentry-status-update">
            <div className="sentry-status-head">
              <span className={`sentry-status-dot sentry-status-dot--${tone}`} />
              <span className={`sentry-status-label sentry-status-label--${tone}`}>Status</span>
              <span className="sentry-status-time">(Unknown)</span>
            </div>
            <p className="sentry-status-msg">Could not load service status.</p>
          </li>
        )}
      </ul>
    </div>
  );
};

const OnboardingMenu = ({
  anchor, onClose, placement, steps, beyondSteps, done, pct,
}: {
  anchor: DOMRect;
  onClose: () => void;
  placement: Placement;
  steps: OnboardingStep[];
  beyondSteps: OnboardingStep[];
  done: number;
  pct: number;
}) => {
  const ref = useDismiss(onClose);
  const [beyondOpen, setBeyondOpen] = useState(false);
  const [skipped, setSkipped] = useLocalStorage<string[]>('ranksmile-onb-skipped', []);

  const skipStep = (key: string) => setSkipped((prev) => [...new Set([...prev, key])]);

  const renderStep = (s: OnboardingStep, skippable: boolean) => (
    <li key={s.key}>
      <div className="sentry-menu-item sentry-menu-item--static">
        <span className={`sentry-onb-check ${s.done ? 'sentry-onb-check--done' : 'sentry-onb-check--pending'}`}>
          {s.done && (
            <svg viewBox="0 0 16 16" width="10" height="10" fill="#fff"><path d="M13.72 3.22C14.01 2.93 14.49 2.93 14.78 3.22C15.07 3.51 15.07 3.99 14.78 4.28L6.53 12.53C6.24 12.82 5.76 12.82 5.47 12.53L1.22 8.28C0.93 7.99 0.93 7.51 1.22 7.22C1.51 6.93 1.99 6.93 2.28 7.22L6 10.94L13.72 3.22Z" /></svg>
          )}
        </span>
        <span className={`sentry-menu-item-label sentry-onb-label ${s.done ? 'sentry-onb-label--done' : ''}`}>{s.label}</span>
        {skippable && !s.done && !skipped.includes(s.key) && (
          <button type="button" className="sentry-onb-skip" aria-label={`Skip ${s.label}`} onClick={() => skipStep(s.key)}>Skip</button>
        )}
      </div>
    </li>
  );

  const visibleBeyond = beyondSteps.filter((s) => !skipped.includes(s.key));

  return (
    <div ref={ref} className="sentry-nav-popover sentry-nav-popover--wide" style={popoverStyle(anchor, placement)}>
      <div className="sentry-menu-title">Getting Started</div>
      <div className="sentry-menu-sub">{done} out of {steps.length} tasks completed · {Math.round(pct)}%</div>
      <ul className="sentry-menu-list sentry-onb-list">
        {steps.map((s) => renderStep(s, false))}
      </ul>
      {visibleBeyond.length > 0 && (
        <>
          <button type="button" className="sentry-onb-section-toggle" onClick={() => setBeyondOpen((p) => !p)} aria-expanded={beyondOpen}>
            Beyond the Basics
            <IconChevron rotate={beyondOpen ? 180 : 90} size={10} />
          </button>
          {beyondOpen && (
            <ul className="sentry-menu-list sentry-onb-list">
              {visibleBeyond.map((s) => renderStep(s, true))}
            </ul>
          )}
        </>
      )}
    </div>
  );
};

const PlanMetricRow = ({ metric }: { metric: PlanLimitMetric }) => {
  const warn = (metric.pct ?? 0) >= 85;
  const width = metric.limit == null ? 0 : Math.min(100, metric.pct ?? 0);
  return (
    <li className="sentry-plan-metric">
      <div className="sentry-plan-metric-head">
        <span className="sentry-plan-metric-label">{metric.label}</span>
        <span className={`sentry-plan-metric-value${warn ? ' sentry-plan-metric-value--warn' : ''}`}>
          {formatMetricUsage(metric)}
        </span>
      </div>
      {metric.limit != null && (
        <div className="sentry-plan-bar" aria-hidden="true">
          <div
            className={`sentry-plan-bar-fill${warn ? ' sentry-plan-bar-fill--warn' : ''}`}
            style={{ width: `${width}%` }}
          />
        </div>
      )}
    </li>
  );
};

const PlanMenu = ({
  anchor, onClose, placement, summary, statusLine, loading,
}: {
  anchor: DOMRect;
  onClose: () => void;
  placement: Placement;
  summary: PlanSummaryData;
  statusLine: string;
  loading: boolean;
}) => {
  const ref = useDismiss(onClose);
  return (
    <div ref={ref} className="sentry-nav-popover sentry-nav-popover--wide" style={popoverStyle(anchor, placement)}>
      <div className="sentry-menu-title">{summary.planName} plan</div>
      <div className="sentry-menu-sub">
        {loading ? 'Loading usage…' : `${statusLine || 'Subscription'} · ${summary.overallPct}% peak usage`}
      </div>
      <ul className="sentry-menu-list" style={{ marginTop: 8 }}>
        {summary.metrics.map((metric) => (
          <PlanMetricRow key={metric.key} metric={metric} />
        ))}
      </ul>
      <Link href="/settings/billing_subscription" passHref prefetch={false}>
        <a className="sentry-plan-settings" onClick={onClose}>
          Manage plan
          <IconChevron rotate={90} size={10} />
        </a>
      </Link>
    </div>
  );
};

const UserMenu = ({
  anchor, onClose, placement, name, email, pic, initial,
}: {
  anchor: DOMRect;
  onClose: () => void;
  placement: Placement;
  name: string;
  email: string;
  pic: string;
  initial: string;
}) => {
  const ref = useDismiss(onClose);
  return (
    <div ref={ref} className="sentry-user-menu" style={popoverStyle(anchor, placement)}>
      <div className="sentry-user-head">
        <span className="sentry-user-avatar">
          {pic ? <img alt="" src={pic} referrerPolicy="no-referrer" /> : <span>{initial}</span>}
        </span>
        <div className="sentry-user-meta">
          {name && <span className="sentry-user-name">{name}</span>}
          <span className="sentry-user-email">{email}</span>
        </div>
      </div>
      <Link href="/settings/profile" passHref prefetch={false}>
        <a className="sentry-user-item">User Settings</a>
      </Link>
      <button
        type="button"
        className="sentry-user-item"
        onClick={async () => { await authClient.signOut(); window.location.href = '/auth/sign-in'; }}
      >
        Sign Out
      </button>
    </div>
  );
};

type PopKind = 'help' | 'whatsnew' | 'status' | 'onboarding' | 'plan' | 'user';

/** Shared footer pill: plan / status / changelog / menu / profile (+ optional onboarding). */
export default function SentryNavFooter({
  orientation = 'vertical',
  placement = 'rail',
}: Props) {
  const { data: profile } = useProfile();
  const { data: gscAccount } = useGscAccount();
  const { data: serviceStatus } = useServiceStatus();
  const statusTone = levelCss(serviceStatus?.overall ?? 'ok');
  const session = authClient.useSession?.();
  const {
    steps: onboardingSteps,
    beyondSteps: onboardingBeyond,
    done: onboardingDone,
    pct: onboardingPct,
    loading: onboardingLoading,
  } = useOnboardingChecklist();
  const showOnboarding = !onboardingLoading && onboardingPct < 100;

  const { data: planSummaryData, isLoading: planSummaryLoading } = useQuery(
    'planSummary',
    () => fetchJson<PlanSummaryResponse>('/api/billing/plan-summary', PLAN_SUMMARY_FALLBACK),
    { staleTime: 5 * 60 * 1000, retry: false },
  );
  const planSummary = planSummaryData?.summary ?? PLAN_SUMMARY_FALLBACK.summary;
  const planStatusLine = planSummaryData?.statusLine ?? '';

  const userPic = (profile?.avatarUrl || gscAccount?.picture) || '';
  const userName = profile?.name || session?.data?.user?.name || '';
  const userEmail = session?.data?.user?.email || '';
  const userInitial = (profile?.name || session?.data?.user?.email || '?').charAt(0).toUpperCase();

  const [popover, setPopover] = useState<{ kind: PopKind; rect: DOMRect } | null>(null);
  const openPopover = (kind: PopKind) => (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPopover((cur) => (cur?.kind === kind ? null : { kind, rect }));
  };
  const closePopover = () => setPopover(null);

  const horizontal = orientation === 'horizontal';

  return (
    <>
      <div className={`sentry-nav-footer${horizontal ? ' sentry-nav-footer--horizontal' : ''}`}>
        <div className={`sentry-nav-btnbar${horizontal ? ' sentry-nav-btnbar--horizontal' : ''}`}>
          {showOnboarding && (
            <button type="button" aria-label="Onboarding" className="sentry-nav-utilbtn" aria-expanded={popover?.kind === 'onboarding'} onClick={openPopover('onboarding')}>
              <NavProgressRing pct={onboardingPct} />
            </button>
          )}
          <button type="button" aria-label="Your plan" className="sentry-nav-utilbtn" aria-expanded={popover?.kind === 'plan'} onClick={openPopover('plan')}>
            <IconCreditCard />
          </button>
          <button type="button" aria-label="Service status" className="sentry-nav-utilbtn" aria-expanded={popover?.kind === 'status'} onClick={openPopover('status')}>
            <IconBroadcast />
            <span className={`sentry-nav-unread sentry-nav-unread--${statusTone}`} aria-hidden="true" />
          </button>
          <button type="button" aria-label="What's New" className="sentry-nav-utilbtn" aria-expanded={popover?.kind === 'whatsnew'} onClick={openPopover('whatsnew')}>
            <IconFire />
          </button>
          <button type="button" aria-label="Help" className="sentry-nav-utilbtn" aria-expanded={popover?.kind === 'help'} onClick={openPopover('help')}>
            <IconEllipsis />
          </button>
          <button type="button" aria-label={session?.data?.user?.email || 'Account'} className="sentry-nav-utilbtn sentry-nav-avatarbtn" aria-expanded={popover?.kind === 'user'} onClick={openPopover('user')}>
            <Avatar src={userPic || undefined} initials={userInitial} size={28} className="sentry-nav-avatar" />
          </button>
        </div>
      </div>

      {popover?.kind === 'help' && <HelpMenu anchor={popover.rect} onClose={closePopover} placement={placement} />}
      {popover?.kind === 'whatsnew' && <WhatsNewMenu anchor={popover.rect} onClose={closePopover} placement={placement} />}
      {popover?.kind === 'status' && <ServiceStatusMenu anchor={popover.rect} onClose={closePopover} placement={placement} />}
      {popover?.kind === 'onboarding' && showOnboarding && (
        <OnboardingMenu
          anchor={popover.rect}
          onClose={closePopover}
          placement={placement}
          steps={onboardingSteps}
          beyondSteps={onboardingBeyond}
          done={onboardingDone}
          pct={onboardingPct}
        />
      )}
      {popover?.kind === 'plan' && (
        <PlanMenu
          anchor={popover.rect}
          onClose={closePopover}
          placement={placement}
          summary={planSummary}
          statusLine={planStatusLine}
          loading={planSummaryLoading}
        />
      )}
      {popover?.kind === 'user' && (
        <UserMenu
          anchor={popover.rect}
          onClose={closePopover}
          placement={placement}
          name={userName}
          email={userEmail}
          pic={userPic}
          initial={userInitial}
        />
      )}
    </>
  );
}
