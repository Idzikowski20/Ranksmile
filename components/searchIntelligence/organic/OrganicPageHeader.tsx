import React, { useMemo } from 'react';
import { CompactSelect, type SelectOption } from '../../koala/core';
import { Flag } from '../../koala/icons/Flag';
import { Icon } from '../../koala/icons/Icon';
import { AUDIT_COUNTRIES } from '../../../lib/countryLang';
import { formatCompact } from './OrganicKpiRow';

const FONT = 'var(--font-family-primary)';

export type OrganicDevice = 'desktop' | 'mobile';
export type OrganicCurrency = 'USD' | 'EUR' | 'PLN' | 'GBP';

const DEVICE_OPTIONS: SelectOption<OrganicDevice>[] = [
  {
    value: 'desktop',
    label: 'Desktop',
    textValue: 'Desktop',
    leadingItems: <Icon name="Monitor" size={16} weight="bold" />,
  },
  {
    value: 'mobile',
    label: 'Mobile',
    textValue: 'Mobile',
    leadingItems: <Icon name="DeviceMobile" size={16} weight="bold" />,
  },
];

const CURRENCY_OPTIONS: SelectOption<OrganicCurrency>[] = [
  { value: 'USD', label: 'USD', textValue: 'USD' },
  { value: 'EUR', label: 'EUR', textValue: 'EUR' },
  { value: 'PLN', label: 'PLN', textValue: 'PLN' },
  { value: 'GBP', label: 'GBP', textValue: 'GBP' },
];

type OrganicPageHeaderInfoProps = {
  countryCode: string;
  onCountryChange: (code: string) => void;
  device: OrganicDevice;
  onDeviceChange: (device: OrganicDevice) => void;
  currency: OrganicCurrency;
  onCurrencyChange: (currency: OrganicCurrency) => void;
  keywordCount?: number;
  fetchedAt?: string | null;
};

const infoItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexShrink: 0,
};

const infoLabelStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--koala-text-secondary)',
  fontFamily: FONT,
  lineHeight: 1,
  marginTop: -1,
};

function InfoItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={infoItemStyle}>
      <span style={infoLabelStyle}>{label}</span>
      {children}
    </div>
  );
}

export function OrganicPageTitle({ domain }: { domain: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
      <span style={{ fontWeight: 400 }}>Keyword list:</span>
      <span
        style={{
          color: 'var(--koala-text-secondary)',
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
  countryCode,
  onCountryChange,
  device,
  onDeviceChange,
  currency,
  onCurrencyChange,
  keywordCount = 0,
  fetchedAt,
}: OrganicPageHeaderInfoProps) {
  const dateLabel = fetchedAt
    ? new Date(fetchedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';

  const country = countryCode.toUpperCase().slice(0, 2);
  const selectedCountry = AUDIT_COUNTRIES.find((c) => c.code === country) || AUDIT_COUNTRIES.find((c) => c.code === 'US') || AUDIT_COUNTRIES[0];

  const countryOptions: SelectOption[] = useMemo(
    () => AUDIT_COUNTRIES.map((c) => ({
      value: c.code,
      label: c.name,
      textValue: `${c.name} ${c.code} ${c.lang}`,
      leadingItems: <Flag code={c.code} size={18} />,
      details: c.lang.toUpperCase(),
    })),
    [],
  );

  const deviceOpt = DEVICE_OPTIONS.find((o) => o.value === device) || DEVICE_OPTIONS[0];
  const currencyOpt = CURRENCY_OPTIONS.find((o) => o.value === currency) || CURRENCY_OPTIONS[0];

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
      <CompactSelect
        size="sm"
        value={selectedCountry.code}
        options={countryOptions}
        onChange={(opt) => onCountryChange(String(opt.value))}
        search={{ placeholder: 'Search market…' }}
        menuMinWidth={220}
        triggerLabel={(
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Flag code={selectedCountry.code} size={16} />
            <span style={{ fontWeight: 600 }}>{selectedCountry.code}</span>
            {keywordCount > 0 ? (
              <span style={{ color: 'var(--koala-text-secondary)', fontSize: 12, fontWeight: 500 }}>
                {formatCompact(keywordCount)}
              </span>
            ) : null}
          </span>
        )}
      />

      <InfoItem label="Device:">
        <CompactSelect
          size="sm"
          value={device}
          options={DEVICE_OPTIONS}
          onChange={(opt) => onDeviceChange(opt.value === 'mobile' ? 'mobile' : 'desktop')}
          menuMinWidth={160}
          triggerLabel={(
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {deviceOpt.leadingItems}
              {deviceOpt.label}
            </span>
          )}
        />
      </InfoItem>

      <InfoItem label="Date:">
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            fontSize: 13,
            color: 'var(--koala-text-primary)',
            fontFamily: FONT,
            lineHeight: 1.2,
          }}
        >
          {dateLabel}
        </span>
      </InfoItem>

      <InfoItem label="Currency:">
        <CompactSelect
          size="sm"
          value={currency}
          options={CURRENCY_OPTIONS}
          onChange={(opt) => {
            const v = String(opt.value);
            if (v === 'USD' || v === 'EUR' || v === 'PLN' || v === 'GBP') onCurrencyChange(v);
          }}
          menuMinWidth={120}
          triggerLabel={currencyOpt.label}
        />
      </InfoItem>
    </div>
  );
}
