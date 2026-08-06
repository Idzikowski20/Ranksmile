import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';

import React, { useCallback, useMemo } from 'react';
import { DateRange, type Range, type RangeKeyDict } from 'react-date-range';
import enUS from 'date-fns/locale/en-US';
import styled from '@emotion/styled';

export interface DateRangePickerProps {
  onChange: (range: { start: Date; end: Date }) => void;
  startDate: Date;
  endDate: Date;
  maxDate?: Date;
  minDate?: Date;
  months?: number;
}

const PRIMARY_KEY = 'primary';

/**
 * Koala UI v11 — Date Picker (Figma node 7510:35028).
 * https://www.figma.com/design/10atLZDuT9iseR10rDwPZC/Koala-UI--v11-?node-id=7510-35028
 *
 * Spec distinguishes two fills, not one: the connector strip between the
 * selected endpoints is --koala-bg-secondary (light grey) with normal text;
 * only the two boundary days (start/end, or a single selected day) get the
 * solid brand fill with on-brand text. Corner radius is also two-tier: the
 * boundary day rounds at button radius (12px) on its outward edge, the
 * connector strip rounds at card radius (16px) at a week/month's own edge.
 */
const StyledWrapper = styled.div`
  padding: 16px;

  .rdrCalendarWrapper:not(.rdrDateRangeWrapper) .rdrDayHovered .rdrDayNumber:after { border: 0; }

  /* Connector strip: every day strictly between the two endpoints. */
  .rdrInRange {
    left: 0; right: 0; top: 3px; bottom: 3px;
    background-color: var(--koala-bg-secondary);
  }

  /* Boundary days: actual start/end (or a single selected day). */
  .rdrSelected, .rdrStartEdge, .rdrEndEdge {
    left: 0; right: 0; top: 3px; bottom: 3px;
    background-color: var(--koala-bg-brand);
  }

  .rdrDayNumber { top: 3px; bottom: 3px; font-weight: 400; }
  .rdrDayNumber span { color: var(--koala-text-primary); }

  .rdrDay:not(.rdrDayPassive) .rdrSelected ~ .rdrDayNumber span,
  .rdrDay:not(.rdrDayPassive) .rdrStartEdge ~ .rdrDayNumber span,
  .rdrDay:not(.rdrDayPassive) .rdrEndEdge ~ .rdrDayNumber span { color: var(--koala-text-on-brand); }

  .rdrDayDisabled { background: none; }
  .rdrDayDisabled .rdrDayNumber span, .rdrDayPassive .rdrDayNumber span { color: var(--koala-text-tertiary); opacity: 0.5; }

  /* Today: small dot under the number, not a ring — matches the Figma mark. */
  .rdrDayToday .rdrDayNumber span { font-weight: 600; &:after { display: none; } }
  .rdrDayToday .rdrDayNumber {
    position: relative;
    &::after {
      content: ''; position: absolute; bottom: 2px; left: 50%;
      width: 4px; height: 4px; border-radius: 50%;
      background: var(--koala-bg-brand); transform: translateX(-50%);
    }
  }
  .rdrDay:not(.rdrDayPassive) .rdrSelected ~ .rdrDayToday .rdrDayNumber::after,
  .rdrDayToday.rdrStartEdge .rdrDayNumber::after,
  .rdrDayToday.rdrEndEdge .rdrDayNumber::after { background: var(--koala-text-on-brand); }

  .rdrDefinedRangesWrapper, .rdrDateDisplayWrapper { display: none; }
  .rdrWeekDays { padding: 0; }
  .rdrWeekDay { color: var(--koala-text-primary); font-weight: 500; }
  .rdrDayInPreview { background: var(--koala-btn-ghost-bg-hover); }

  .rdrMonth { width: 252px; font-size: 1.2em; padding: 0; }
  .rdrMonths.rdrMonthsHorizontal > div > div > div:first-child { border-right: 1px solid var(--koala-border-primary); padding-right: 12px; }
  .rdrMonths.rdrMonthsHorizontal > div > div > div + div { padding-left: 12px; }
  .rdrDay { height: 36px; }

  /* Boundary day rounds at button radius on its outward-facing side only. */
  .rdrStartEdge { border-top-left-radius: 12px; border-bottom-left-radius: 12px; }
  .rdrEndEdge { border-top-right-radius: 12px; border-bottom-right-radius: 12px; }
  .rdrStartEdge.rdrEndEdge { border-radius: 12px; }

  .rdrDayStartPreview, .rdrDayEndPreview, .rdrDayInPreview { border: 0; background: var(--koala-btn-ghost-bg-hover); z-index: -1; }

  /* Connector strip rounds at card radius where it meets a week/month edge. */
  .rdrDayStartOfMonth .rdrInRange, .rdrDayStartOfMonth .rdrDayInPreview,
  .rdrDayStartOfWeek .rdrInRange, .rdrDayStartOfWeek .rdrEndEdge, .rdrDayStartOfWeek .rdrDayInPreview,
  .rdrDayStartOfWeek .rdrDayEndPreview:not(.rdrDayStartPreview):first-child,
  :not(.rdrStartEdge) ~ .rdrDayEndPreview:not(.rdrDayStartPreview) {
    border-top-left-radius: 16px; border-bottom-left-radius: 16px;
  }

  .rdrDayEndOfMonth .rdrInRange, .rdrDayEndOfMonth .rdrDayInPreview,
  .rdrDayEndOfWeek .rdrInRange, .rdrDayEndOfWeek .rdrStartEdge, .rdrDayEndOfWeek .rdrDayInPreview,
  .rdrDayEndOfWeek .rdrDayStartPreview:not(.rdrDayEndPreview):first-child,
  :not(.rdrEndEdge) ~ .rdrDayStartPreview:not(.rdrDayEndPreview) {
    border-top-right-radius: 16px; border-bottom-right-radius: 16px;
  }

  .rdrDayStartOfMonth .rdrInRange, .rdrDayStartOfMonth .rdrEndEdge,
  .rdrDayStartOfWeek .rdrInRange, .rdrDayStartOfWeek .rdrEndEdge { left: 0; }
  .rdrDayEndOfMonth .rdrInRange, .rdrDayEndOfMonth .rdrStartEdge,
  .rdrDayEndOfWeek .rdrInRange, .rdrDayEndOfWeek .rdrStartEdge { right: 0; }

  .rdrMonthAndYearWrapper { height: 32px; align-items: stretch; padding-bottom: 8px; padding-top: 0; }

  .rdrMonthAndYearPickers {
    font-weight: 500; font-size: 14px; color: var(--koala-text-primary);
  }

  .rdrMonthsVertical { align-items: center; }
  .rdrCalendarWrapper { flex: 1; background: none; }

  .rdrNextPrevButton {
    width: 32px; height: 32px; display: flex; justify-content: center; align-items: center;
    background-color: transparent; border: none; border-radius: 8px;
  }
  .rdrNextPrevButton:hover { background-color: var(--koala-btn-ghost-bg-hover); }
  .rdrPprevButton { margin-left: 0; }
  .rdrNextButton { margin-right: 0; }
  .rdrPprevButton i { border-right-color: var(--koala-text-secondary); margin: 0; }
  .rdrNextButton i { border-left-color: var(--koala-text-secondary); margin: 0; }
  .rdrDayPassive { visibility: hidden; }
`;

function isRangeSelection(rangesByKey: RangeKeyDict): rangesByKey is { primary: Range } {
  return rangesByKey?.[PRIMARY_KEY] !== undefined;
}

export function DateRangePicker({ onChange: onCh, startDate, endDate, maxDate, minDate, months = 2 }: DateRangePickerProps) {
  const onChange = useCallback((rangesByKey: RangeKeyDict) => {
    if (!isRangeSelection(rangesByKey)) return;
    const r = rangesByKey[PRIMARY_KEY];
    if (r.startDate && r.endDate) onCh({ start: r.startDate, end: r.endDate });
  }, [onCh]);

  const ranges: Range[] = useMemo(() => [{ startDate, endDate, key: PRIMARY_KEY }], [endDate, startDate]);

  return (
    <StyledWrapper>
      <DateRange
        onChange={onChange}
        ranges={ranges}
        months={months}
        direction="horizontal"
        maxDate={maxDate || new Date()}
        minDate={minDate}
        showMonthAndYearPickers={false}
        showDateDisplay={false}
        showPreview
        moveRangeOnFirstSelection={false}
        retainEndDateOnFirstSelection
        rangeColors={['var(--koala-bg-brand)']}
        locale={enUS}
      />
    </StyledWrapper>
  );
}

export default DateRangePicker;
