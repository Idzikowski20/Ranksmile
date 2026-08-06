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

const StyledWrapper = styled.div`
  padding: 16px;

  .rdrCalendarWrapper:not(.rdrDateRangeWrapper) .rdrDayHovered .rdrDayNumber:after { border: 0; }

  .rdrSelected, .rdrInRange, .rdrStartEdge, .rdrEndEdge {
    left: 0; right: 0; top: 3px; bottom: 3px;
    background-color: var(--brand-hover);
  }

  .rdrDayNumber { top: 3px; bottom: 3px; font-weight: 400; }
  .rdrDayNumber span { color: var(--koala-text-primary); }

  .rdrDay:not(.rdrDayPassive) .rdrStartEdge ~ .rdrDayNumber span,
  .rdrDay:not(.rdrDayPassive) .rdrEndEdge ~ .rdrDayNumber span,
  .rdrDay:not(.rdrDayPassive) .rdrInRange ~ .rdrDayNumber span { color: var(--koala-text-on-brand); }

  .rdrDayDisabled { background: none; }
  .rdrDayDisabled .rdrDayNumber span, .rdrDayPassive .rdrDayNumber span { color: var(--koala-text-tertiary); opacity: 0.5; }

  .rdrDayToday .rdrDayNumber span { color: var(--koala-text-brand); &:after { display: none; } }
  .rdrDayToday .rdrDayNumber { border-radius: 2rem; box-shadow: inset 0 0 0 2px var(--brand-hover); }

  .rdrDayNumber span:after { background-color: var(--brand-hover); font-variant-numeric: tabular-nums; }

  .rdrDefinedRangesWrapper, .rdrDateDisplayWrapper, .rdrWeekDays { display: none; }
  .rdrInRange { background: var(--brand-hover); }
  .rdrDayInPreview { background: var(--koala-btn-ghost-bg-hover); }

  .rdrMonth { width: 300px; font-size: 1.2em; padding: 0; }
  .rdrStartEdge { border-top-left-radius: 1.14em; border-bottom-left-radius: 1.14em; }
  .rdrEndEdge { border-top-right-radius: 1.14em; border-bottom-right-radius: 1.14em; }

  .rdrDayStartPreview, .rdrDayEndPreview, .rdrDayInPreview { border: 0; background: var(--koala-btn-ghost-bg-hover); z-index: -1; }

  .rdrDayStartOfMonth .rdrInRange, .rdrDayStartOfMonth .rdrDayInPreview,
  .rdrDayStartOfWeek .rdrInRange, .rdrDayStartOfWeek .rdrEndEdge, .rdrDayStartOfWeek .rdrDayInPreview,
  .rdrDayStartOfWeek .rdrDayEndPreview:not(.rdrDayStartPreview):first-child,
  :not(.rdrStartEdge) ~ .rdrDayEndPreview:not(.rdrDayStartPreview) {
    border-top-left-radius: 6px; border-bottom-left-radius: 6px;
  }

  .rdrDayEndOfMonth .rdrInRange, .rdrDayEndOfMonth .rdrDayInPreview,
  .rdrDayEndOfWeek .rdrInRange, .rdrDayEndOfWeek .rdrStartEdge, .rdrDayEndOfWeek .rdrDayInPreview,
  .rdrDayEndOfWeek .rdrDayStartPreview:not(.rdrDayEndPreview):first-child,
  :not(.rdrEndEdge) ~ .rdrDayStartPreview:not(.rdrDayEndPreview) {
    border-top-right-radius: 6px; border-bottom-right-radius: 6px;
  }

  .rdrDayStartOfMonth .rdrInRange, .rdrDayStartOfMonth .rdrEndEdge,
  .rdrDayStartOfWeek .rdrInRange, .rdrDayStartOfWeek .rdrEndEdge { left: 0; }
  .rdrDayEndOfMonth .rdrInRange, .rdrDayEndOfMonth .rdrStartEdge,
  .rdrDayEndOfWeek .rdrInRange, .rdrDayEndOfWeek .rdrStartEdge { right: 0; }

  .rdrStartEdge.rdrEndEdge { border-radius: 1.14em; }

  .rdrMonthAndYearWrapper { height: 32px; align-items: stretch; padding-bottom: 8px; padding-top: 0; }
  .rdrDay { height: 2.5em; }

  .rdrMonthPicker select, .rdrYearPicker select {
    background: none; color: var(--koala-text-primary); font-weight: 400; font-size: 16px; padding: 2px 8px;
  }

  .rdrMonthsVertical { align-items: center; }
  .rdrCalendarWrapper { flex: 1; background: none; }

  .rdrNextPrevButton {
    width: 44px; display: flex; justify-content: center; align-items: center;
    height: auto; background-color: transparent; border: none;
  }
  .rdrNextPrevButton:hover, .rdrMonthPicker:hover, .rdrYearPicker:hover {
    position: relative; background-color: transparent;
    &::after { content: ''; position: absolute; inset: 0; border-radius: 6px; background: var(--koala-btn-ghost-bg-hover); z-index: -1; }
  }
  .rdrMonthPicker select:hover, .rdrYearPicker select:hover { background-color: transparent; }
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
        showMonthAndYearPickers
        showDateDisplay={false}
        showPreview
        moveRangeOnFirstSelection={false}
        retainEndDateOnFirstSelection
        rangeColors={['var(--brand-hover)']}
        locale={enUS}
      />
    </StyledWrapper>
  );
}

export default DateRangePicker;
