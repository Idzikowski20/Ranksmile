import React, { useMemo, useState } from 'react';
import {
  Button,
  CompactSelect,
  Input,
  PageFilterBar,
  SearchBar,
  type SelectOptionOrSection,
} from '../../core';
import type { OrganicFilters } from '../../../lib/organicResearch/filter';
import {
  kdFilterFromValue,
  kdFilterValue,
  positionFilterFromValue,
  positionFilterValue,
  volumeFilterFromValue,
  volumeFilterValue,
} from '../../../lib/organicResearch/filter';
import type { SearchIntent } from '../../../lib/organicResearch/types';

const FONT = 'var(--font-family-primary)';

const POSITION_OPTIONS: SelectOptionOrSection<string>[] = [
  {
    key: 'presets',
    options: [
      { value: 'top50', label: 'Top 50' },
      { value: 'top20', label: 'Top 20' },
      { value: 'top10', label: 'Top 10' },
      { value: 'top3', label: 'Top 3' },
    ],
  },
  {
    key: 'ranges',
    options: [
      { value: 'pos1', label: '#1' },
      { value: '4_10', label: '#4–10' },
      { value: '11_20', label: '#11–20' },
      { value: '21_50', label: '#21–50' },
      { value: '51_100', label: '#51–100' },
    ],
  },
];

const VOLUME_OPTIONS: SelectOptionOrSection<string>[] = [
  { value: '100001+', label: '100,001+' },
  { value: '10001-100000', label: '10,001–100,000' },
  { value: '1001-10000', label: '1,001–10,000' },
  { value: '101-1000', label: '101–1,000' },
  { value: '11-100', label: '11–100' },
  { value: '1-10', label: '1–10' },
];

const KD_OPTIONS: SelectOptionOrSection<string>[] = [
  { value: 'very_hard', label: 'Very hard', details: '85–100%' },
  { value: 'hard', label: 'Hard', details: '70–84%' },
  { value: 'difficult', label: 'Difficult', details: '50–69%' },
  { value: 'possible', label: 'Possible', details: '30–49%' },
  { value: 'easy', label: 'Easy', details: '15–29%' },
  { value: 'very_easy', label: 'Very easy', details: '0–14%' },
];

const INTENT_OPTIONS: SelectOptionOrSection<string>[] = [
  { value: 'informational', label: 'Informational' },
  { value: 'navigational', label: 'Navigational' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'transactional', label: 'Transactional' },
];

type Props = {
  filters: OrganicFilters;
  onChange: (next: OrganicFilters) => void;
  serpFeatureOptions?: string[];
  /** GSC mode hides DFS-only filters (KD, Intent, SERP Features). */
  mode?: 'gsc' | 'labs';
};

function RangeApply({
  from,
  to,
  onApply,
  close,
}: {
  from: string;
  to: string;
  onApply: (from: number | null, to: number | null) => void;
  close: () => void;
}) {
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);
  return (
    <div style={{ padding: '8px 12px 12px', borderTop: '1px solid #F0F0F2', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#181225', fontFamily: FONT }}>Custom range</div>
      <div style={{ display: 'flex', border: '1px solid #DAD9DE', borderRadius: 6, overflow: 'hidden' }}>
        <Input
          size="sm"
          placeholder="From"
          value={f}
          onChange={(e) => setF(e.target.value)}
          style={{ border: 'none', borderRadius: 0, flex: 1, boxShadow: 'none' }}
        />
        <div style={{ width: 1, background: '#DAD9DE', flexShrink: 0 }} />
        <Input
          size="sm"
          placeholder="To"
          value={t}
          onChange={(e) => setT(e.target.value)}
          style={{ border: 'none', borderRadius: 0, flex: 1, boxShadow: 'none' }}
        />
      </div>
      <Button
        type="button"
        variant="primary"
        size="sm"
        onClick={() => {
          const fromN = f.trim() === '' ? null : Number(f);
          const toN = t.trim() === '' ? null : Number(t);
          onApply(
            fromN != null && Number.isFinite(fromN) ? fromN : null,
            toN != null && Number.isFinite(toN) ? toN : null,
          );
          close();
        }}
      >
        Apply
      </Button>
    </div>
  );
}

function triggerLabel(base: string, active: boolean, detail?: string): React.ReactNode {
  if (!active) return base;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span>{detail || base}</span>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F29964', flexShrink: 0 }} />
    </span>
  );
}

export default function OrganicFilterBar({ filters, onChange, serpFeatureOptions = [], mode = 'gsc' }: Props) {
  const isGsc = mode === 'gsc';
  const posVal = positionFilterValue(filters);
  const volVal = volumeFilterValue(filters);
  const kdVal = kdFilterValue(filters);
  const intents = (filters.intents || []).filter(Boolean) as string[];
  const features = filters.serpFeatures || [];

  const posLabel = useMemo(() => {
    if (posVal === 'all') return 'Positions';
    const flat = POSITION_OPTIONS.flatMap((o) => ('options' in o ? o.options : [o]));
    return flat.find((o) => o.value === posVal)?.label?.toString() || 'Positions';
  }, [posVal]);

  const volLabel = useMemo(() => {
    if (volVal === 'all') return 'Volume';
    const flat = VOLUME_OPTIONS.flatMap((o) => ('options' in o ? o.options : [o]));
    return flat.find((o) => o.value === volVal)?.label?.toString() || 'Volume';
  }, [volVal]);

  const kdLabel = useMemo(() => {
    if (kdVal === 'all') return 'KD';
    const flat = KD_OPTIONS.flatMap((o) => ('options' in o ? o.options : [o]));
    return flat.find((o) => o.value === kdVal)?.label?.toString() || 'KD';
  }, [kdVal]);

  const serpOptions: SelectOptionOrSection<string>[] = useMemo(
    () => (serpFeatureOptions.length
      ? serpFeatureOptions.map((f) => ({ value: f, label: f.replace(/_/g, ' ') }))
      : [{ value: '', label: 'No features', disabled: true }]),
    [serpFeatureOptions],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ minWidth: 220, maxWidth: 320 }}>
        <SearchBar
          value={filters.q || ''}
          onChange={(q) => onChange({ ...filters, q })}
          placeholder="Filter by keyword"
          width="100%"
        />
      </div>

      <PageFilterBar condensed>
        <CompactSelect
          size="sm"
          clearable={posVal !== 'all'}
          menuMinWidth={220}
          options={POSITION_OPTIONS}
          value={posVal.startsWith('custom:') ? undefined : (posVal === 'all' ? undefined : posVal)}
          triggerLabel={triggerLabel('Positions', posVal !== 'all', String(posLabel))}
          onChange={(opt) => onChange({ ...filters, ...positionFilterFromValue(opt.value || 'all') })}
          menuBody={({ close }) => (
            <RangeApply
              from={filters.positionMin != null ? String(filters.positionMin) : ''}
              to={filters.positionMax != null ? String(filters.positionMax) : ''}
              close={close}
              onApply={(from, to) => onChange({ ...filters, positionMin: from, positionMax: to })}
            />
          )}
        />

        <CompactSelect
          size="sm"
          clearable={volVal !== 'all'}
          menuMinWidth={220}
          options={VOLUME_OPTIONS}
          value={volVal.startsWith('custom:') ? undefined : (volVal === 'all' ? undefined : volVal)}
          triggerLabel={triggerLabel(isGsc ? 'Impressions' : 'Volume', volVal !== 'all', String(volLabel))}
          onChange={(opt) => onChange({ ...filters, ...volumeFilterFromValue(opt.value || 'all') })}
          menuBody={({ close }) => (
            <RangeApply
              from={filters.volumeMin != null ? String(filters.volumeMin) : ''}
              to={filters.volumeMax != null ? String(filters.volumeMax) : ''}
              close={close}
              onApply={(from, to) => onChange({ ...filters, volumeMin: from, volumeMax: to })}
            />
          )}
        />

        {!isGsc && (
          <CompactSelect
            size="sm"
            clearable={kdVal !== 'all'}
            menuMinWidth={240}
            options={KD_OPTIONS}
            value={kdVal.startsWith('custom:') ? undefined : (kdVal === 'all' ? undefined : kdVal)}
            triggerLabel={triggerLabel('KD', kdVal !== 'all', String(kdLabel))}
            onChange={(opt) => onChange({ ...filters, ...kdFilterFromValue(opt.value || 'all') })}
            menuBody={({ close }) => (
              <RangeApply
                from={filters.kdMin != null ? String(filters.kdMin) : ''}
                to={filters.kdMax != null ? String(filters.kdMax) : ''}
                close={close}
                onApply={(from, to) => onChange({ ...filters, kdMin: from, kdMax: to })}
              />
            )}
          />
        )}

        {!isGsc && (
          <CompactSelect
            multiple
            size="sm"
            clearable={intents.length > 0}
            menuMinWidth={220}
            options={INTENT_OPTIONS}
            value={intents}
            triggerLabel={
              intents.length === 0
                ? 'Intent'
                : intents.length === 1
                  ? intents[0][0].toUpperCase() + intents[0].slice(1)
                  : triggerLabel('Intent', true, `${intents.length} intents`)
            }
            onChange={(opts) => onChange({
              ...filters,
              intents: opts.map((o) => o.value as NonNullable<SearchIntent>),
            })}
          />
        )}

        {!isGsc && (
          <CompactSelect
            multiple
            size="sm"
            search
            clearable={features.length > 0}
            menuMinWidth={260}
            options={serpOptions}
            value={features}
            triggerLabel={
              features.length === 0
                ? 'SERP Features'
                : features.length === 1
                  ? features[0].replace(/_/g, ' ')
                  : triggerLabel('SERP Features', true, `${features.length} features`)
            }
            onChange={(opts) => onChange({
              ...filters,
              serpFeatures: opts.map((o) => o.value).filter(Boolean),
            })}
          />
        )}

        <CompactSelect
          size="sm"
          menuMinWidth={200}
          options={[
            { value: 'all', label: 'Any state' },
            { value: 'growing', label: 'Growing' },
            { value: 'declining', label: 'Declining' },
            { value: 'new', label: 'New' },
            { value: 'stable', label: 'Stable' },
            { value: 'lost', label: 'Lost' },
          ]}
          value={filters.state && filters.state !== 'all' ? filters.state : undefined}
          triggerLabel={
            !filters.state || filters.state === 'all'
              ? 'State'
              : triggerLabel('State', true, String(filters.state)[0].toUpperCase() + String(filters.state).slice(1))
          }
          clearable={!!filters.state && filters.state !== 'all'}
          onChange={(opt) => onChange({
            ...filters,
            state: !opt.value || opt.value === 'all' ? 'all' : opt.value as OrganicFilters['state'],
          })}
        />
      </PageFilterBar>
    </div>
  );
}
