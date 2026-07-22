import React from 'react';
import { formatCompact } from './OrganicKpiRow';

const FONT = 'var(--font-family-primary)';

function FlagIcon({ code }: { code: string }) {
  const cc = code.toLowerCase().slice(0, 2);
  return (
    <img
      src={`https://cdn.jsdelivr.net/npm/flag-icons@6.11.1/flags/4x3/${cc}.svg`}
      alt=""
      width={16}
      height={12}
      style={{ display: 'block', boxShadow: 'rgba(0, 0, 0, 0.35) 0 0 1px 0' }}
    />
  );
}

function IconDesktop() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M1 2.5A1.5 1.5 0 0 1 2.5 1h11A1.5 1.5 0 0 1 15 2.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 9.5v-7ZM3 3v6h10V3H3Z"
      />
      <path d="M4 14a1 1 0 0 1 1-1h2v-1h2v1h2a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1Z" />
    </svg>
  );
}

function IconChevronDown() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M3.293 6.293a1 1 0 0 1 1.414 0L8 9.586l3.293-3.293a1 1 0 1 1 1.414 1.414l-4 4a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 0-1.414Z"
      />
    </svg>
  );
}

type CountryPill = {
  code: string;
  count: number;
};

type OrganicPageHeaderInfoProps = {
  countries: CountryPill[];
  activeCountry: string;
  fetchedAt?: string | null;
  device?: 'desktop' | 'mobile';
  currency?: string;
};

const infoItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexShrink: 0,
};

const infoLabelStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#6A6772',
  fontFamily: FONT,
  lineHeight: 1,
  marginTop: -1,
};

const linkTriggerStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  border: 'none',
  background: 'transparent',
  padding: 0,
  cursor: 'default',
  fontSize: 13,
  color: '#302E36',
  fontFamily: FONT,
  lineHeight: 1.2,
};

function InfoItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={infoItemStyle}>
      <span style={infoLabelStyle}>{label}</span>
      {children}
    </div>
  );
}

function LinkTrigger({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <button type="button" style={linkTriggerStyle} aria-label={label}>
      {children}
      <IconChevronDown />
    </button>
  );
}

function CountryPills({ countries, activeCountry }: { countries: CountryPill[]; activeCountry: string }) {
  if (!countries.length) return null;

  return (
    <div
      role="radiogroup"
      aria-label="Countries"
      style={{
        display: 'inline-flex',
        alignItems: 'stretch',
        borderRadius: 6,
        border: '1px solid #DAD9DE',
        overflow: 'hidden',
        background: '#fff',
      }}
    >
      {countries.map((c, i) => {
        const selected = c.code.toUpperCase() === activeCountry.toUpperCase();
        const isLast = i === countries.length - 1;
        return (
          <button
            key={c.code}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 10px 5px 8px',
              border: 'none',
              borderRight: isLast ? 'none' : '1px solid #DAD9DE',
              background: selected ? '#F0F0F2' : '#fff',
              cursor: 'default',
              fontFamily: FONT,
              fontSize: 13,
              fontWeight: selected ? 600 : 400,
              color: '#302E36',
            }}
          >
            <FlagIcon code={c.code} />
            <span>{c.code.toUpperCase()}</span>
            <span style={{ color: '#6A6772', fontSize: 12, marginLeft: 2 }}>
              {formatCompact(c.count)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function OrganicPageTitle({ domain }: { domain: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
      <span style={{ fontWeight: 400 }}>Search Intelligence:</span>
      <span
        style={{
          color: '#6A6772',
          fontWeight: 400,
          fontSize: 'inherit',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: 'min(100%, 480px)',
        }}
      >
        {domain}
      </span>
    </span>
  );
}

export function OrganicPageHeaderInfo({
  countries,
  activeCountry,
  fetchedAt,
  device = 'desktop',
  currency = 'USD',
}: OrganicPageHeaderInfoProps) {
  const dateLabel = fetchedAt
    ? new Date(fetchedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '12px 20px',
        marginTop: 8,
      }}
    >
      <CountryPills countries={countries} activeCountry={activeCountry} />

      <InfoItem label="Device:">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#302E36', fontFamily: FONT }}>
          <IconDesktop />
          {device === 'desktop' ? 'Desktop' : 'Mobile'}
        </span>
      </InfoItem>

      <InfoItem label="Date:">
        <LinkTrigger label="Dataset date">
          <span>{dateLabel}</span>
        </LinkTrigger>
      </InfoItem>

      <InfoItem label="Currency:">
        <LinkTrigger label="Currency">
          <span>{currency}</span>
        </LinkTrigger>
      </InfoItem>
    </div>
  );
}
