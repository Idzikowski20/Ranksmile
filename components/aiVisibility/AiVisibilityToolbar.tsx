import React, { useMemo } from 'react';
import {
  Button,
  CompactSelect,
  PageFilterBar,
  TimeRangeFilter,
  type SelectOption,
  type SelectSection,
  type TimeRangeValue,
} from '../core';
import { ModelIcon, isKnownModel } from './modelIcons';
import type { PromptOption } from './types';

const favicon = (d: string) => `https://www.google.com/s2/favicons?domain=${d}&sz=32`;

type AiVisibilityToolbarProps = {
  dateRange?: TimeRangeValue;
  onDateRangeChange?: (v: TimeRangeValue) => void;
  compareCompetitors?: Array<{ domain: string }>;
  compareSelected?: string | null;
  onCompareSelect?: (d: string | null) => void;
  prompts?: PromptOption[];
  promptSelected?: number[];
  onPromptChange?: (ids: number[]) => void;
  models?: string[];
  modelSelected?: string[];
  onModelChange?: (m: string[]) => void;
  modelLabel?: Record<string, string>;
  trailing?: React.ReactNode;
};

const AiVisibilityToolbar = ({
  dateRange,
  onDateRangeChange,
  compareCompetitors,
  compareSelected = null,
  onCompareSelect,
  prompts,
  promptSelected,
  onPromptChange,
  models,
  modelSelected,
  onModelChange,
  modelLabel,
  trailing,
}: AiVisibilityToolbarProps) => {
  const modelInteractive = !!(models && models.length && onModelChange);
  const modelSel = modelSelected || [];
  const modelLabelFor = (m: string): string => (modelLabel && modelLabel[m]) || m;

  const promptSections = useMemo((): SelectSection<number>[] => {
    if (!prompts?.length) return [];
    const groups = new Map<string, PromptOption[]>();
    prompts.forEach((p) => {
      const t = p.topic || 'Prompts';
      if (!groups.has(t)) groups.set(t, []);
      groups.get(t)!.push(p);
    });
    return Array.from(groups.entries()).map(([topic, items]) => ({
      label: topic,
      options: items.map((p) => ({ value: p.id, label: p.text, textValue: p.text })),
    }));
  }, [prompts]);

  const promptValue = promptSelected?.length ? promptSelected : prompts?.map((p) => p.id) ?? [];

  const modelOptions = useMemo((): SelectOption<string>[] => {
    if (!modelInteractive) return [];
    return (models as string[]).map((m) => ({
      value: m,
      label: modelLabelFor(m),
      leadingItems: isKnownModel(modelLabelFor(m)) ? <ModelIcon model={modelLabelFor(m)} size={18} /> : undefined,
    }));
  }, [modelInteractive, models, modelLabel]);

  const compareOptions = useMemo((): SelectOption<string>[] => (
    (compareCompetitors || []).map((c) => ({
      value: c.domain,
      label: c.domain,
      leadingItems: (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" src={favicon(c.domain)} width={16} height={16} style={{ borderRadius: 3 }} />
      ),
    }))
  ), [compareCompetitors]);

  const defaultDate: TimeRangeValue = {
    start: new Date(Date.now() - 29 * 86_400_000),
    end: new Date(),
    label: 'Jul 02, 2026',
  };

  return (
    <PageFilterBar condensed>
      <TimeRangeFilter
        value={dateRange ?? defaultDate}
        onChange={onDateRangeChange ?? (() => {})}
        disabled={!onDateRangeChange}
      />

      {prompts && prompts.length ? (
        <CompactSelect
          multiple
          options={promptSections}
          value={promptValue}
          search
          triggerLabel={
            !promptSelected?.length || promptSelected.length === prompts.length
              ? 'All prompts'
              : promptSelected.length === 1
                ? prompts.find((p) => p.id === promptSelected[0])?.text ?? '1 prompt'
                : `${promptSelected.length} prompts`
          }
          onChange={(opts) => {
            const ids = opts.map((o) => o.value);
            const allIds = prompts.map((p) => p.id);
            onPromptChange?.(ids.length === 0 || ids.length === allIds.length ? [] : ids);
          }}
        />
      ) : (
        <CompactSelect options={[{ value: 'all', label: 'All prompts' }]} value="all" onChange={() => {}} disabled />
      )}

      {compareCompetitors?.length && onCompareSelect ? (
        <CompactSelect
          options={compareOptions}
          value={compareSelected ?? undefined}
          prefix="Comparing with"
          search
          clearable
          triggerLabel={
            compareSelected ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="" src={favicon(compareSelected)} width={16} height={16} style={{ borderRadius: 3, flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{compareSelected}</span>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#653DE9', flexShrink: 0 }} />
              </span>
            ) : 'Compare'
          }
          onChange={(opt) => onCompareSelect(opt.value || null)}
        />
      ) : (
        <CompactSelect options={[{ value: '', label: 'Compare' }]} value="" onChange={() => {}} disabled />
      )}

      {modelInteractive ? (
        <CompactSelect
          multiple
          options={modelOptions}
          value={modelSel.length ? modelSel : (models as string[])}
          triggerLabel={
            modelSel.length === 1
              ? modelLabelFor(modelSel[0])
              : modelSel.length > 1
                ? `${modelSel.length} models`
                : 'All models'
          }
          onChange={(opts) => {
            const next = opts.map((o) => o.value);
            onModelChange?.(next.length === 0 || next.length === (models || []).length ? [] : next);
          }}
        />
      ) : (
        <CompactSelect
          options={[{ value: 'all', label: 'All models' }]}
          value="all"
          onChange={() => {}}
          disabled
        />
      )}

      {trailing}
    </PageFilterBar>
  );
};

export default AiVisibilityToolbar;
