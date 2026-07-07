import React, { useMemo, useState } from 'react';
import { CompactSelect } from '../compactSelect/compactSelect';
import { DateRangePicker } from '../calendar/dateRangePicker';
import { Button } from '../button/button';
import type { ButtonSize } from '../button/types';

export type TimeRangeValue = {
  start: Date;
  end: Date;
  label?: string;
};

type TimeRangeFilterProps = {
  value: TimeRangeValue;
  onChange: (value: TimeRangeValue) => void;
  presets?: Array<{ label: string; days: number }>;
  maxDate?: Date;
  disabled?: boolean;
  size?: ButtonSize;
  menuTitle?: string;
};

const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export function TimeRangeFilter({
  value,
  onChange,
  presets = [
    { label: '7D', days: 7 },
    { label: '30D', days: 30 },
    { label: '90D', days: 90 },
  ],
  maxDate,
  disabled,
  size = 'sm',
  menuTitle = 'Filter time range',
}: TimeRangeFilterProps) {
  const [draft, setDraft] = useState(value);

  const label = value.label ?? `${fmt(value.start)} – ${fmt(value.end)}`;

  const presetButtons = useMemo(() => presets, [presets]);

  return (
    <CompactSelect
      disabled={disabled}
      size={size}
      options={[]}
      hideOptions
      triggerLabel={label}
      menuTitle={menuTitle}
      menuWidth="min(580px, calc(100vw - 2rem))"
      menuBody={({ close }) => (
        <div className="sentry-time-range-filter">
          <div className="sentry-time-range-filter-presets">
            {presetButtons.map((p) => (
              <Button
                key={p.label}
                type="button"
                size="xs"
                variant="secondary"
                onClick={() => {
                  const end = maxDate ?? new Date();
                  const start = new Date(end);
                  start.setDate(start.getDate() - (p.days - 1));
                  const next = { start, end, label: p.label };
                  setDraft(next);
                  onChange(next);
                  close();
                }}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <DateRangePicker
            startDate={draft.start}
            endDate={draft.end}
            maxDate={maxDate}
            onChange={({ start, end }) => {
              const next = { start, end };
              setDraft(next);
              onChange(next);
              close();
            }}
          />
        </div>
      )}
    />
  );
}

export default TimeRangeFilter;
