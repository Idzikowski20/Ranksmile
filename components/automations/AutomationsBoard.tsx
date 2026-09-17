import React, { useMemo, useRef, useState } from 'react';
import type { AutomationEvent, AutomationEventStatus, AutomationPublishMode } from '@/src/core/shared/types/automations';
import {
  weekDays, groupEventsByDay, weekRangeLabel, columnDateLabel, toDateKey, statusBadge, publishLabel,
  filterEvents, type BadgeColor,
} from '@/src/core/domain/automations/board';
import { Icon } from '../koala/icons/Icon';
import { blue, green, orange, purple, red } from '../koala/tokens/colors';

const AVATAR_BG: Record<BadgeColor, string> = {
  blue: blue[500],
  orange: orange[500],
  green: green[500],
  purple: purple[500],
  red: red[500],
};

const STATUS_OPTIONS: Array<{ value: AutomationEventStatus; label: string }> = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'generating', label: 'Generating' },
  { value: 'created', label: 'Draft ready' },
  { value: 'published', label: 'Published' },
  { value: 'failed', label: 'Failed' },
];

const MODE_OPTIONS: Array<{ value: AutomationPublishMode; label: string }> = [
  { value: 'draft', label: 'Draft' },
  { value: 'live', label: 'Live' },
];

export type AutomationsBoardProps = {
  weekAnchor: Date;
  events: AutomationEvent[];
  onPrevWeek: () => void;
  onNextWeek: () => void;
  /** The range pill jumps back to the current week. */
  onThisWeek: () => void;
  onAdd: () => void;
  onDayAdd: (date: Date) => void;
  onEventClick?: (event: AutomationEvent) => void;
  onEventDelete?: (event: AutomationEvent) => void;
};

/** A toolbar dropdown: native select dressed as the calendar's "Post Time ▾" button. */
function SelectButton<T extends string>({
  label, allLabel, value, options, onChange,
}: {
  label: string;
  allLabel: string;
  value: T | '';
  options: Array<{ value: T; label: string }>;
  onChange: (v: T | '') => void;
}) {
  return (
    <span className="cal-select">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value as T | '')}
        className="cal-btn cal-select__control"
      >
        <option value="">{allLabel}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <Icon name="CaretDown" size={14} weight="bold" className="cal-select__caret" />
    </span>
  );
}

function FilterChip({ label, value, onClear }: { label: string; value: string; onClear: () => void }) {
  return (
    <span className="cal-chip">
      <span className="cal-chip__label">{label}:</span>
      <strong className="cal-chip__value">{value}</strong>
      <button type="button" className="cal-chip__clear" aria-label={`Clear ${label}`} onClick={onClear}>
        <Icon name="X" size={11} weight="bold" />
      </button>
    </span>
  );
}

function EventCard({ ev, onClick, onDelete }: { ev: AutomationEvent; onClick?: () => void; onDelete?: () => void }) {
  const badge = statusBadge(ev.status);
  const clickable = !!onClick && ev.articleId != null;
  return (
    <article
      className={`cal-card${clickable ? ' cal-card--link' : ''}`}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      title={ev.targetKeyword ? `${ev.title} · ${ev.targetKeyword}` : ev.title}
      onClick={clickable ? onClick : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } } : undefined}
    >
      <div className="cal-card__tag">
        <span className="cal-card__avatar" style={{ background: AVATAR_BG[badge.color] }} aria-hidden="true">{badge.initial}</span>
        <span className="cal-card__tag-label">{badge.label}</span>
      </div>
      <div className="cal-card__rule" />
      <h3 className="cal-card__title">{ev.title}</h3>
      <div className="cal-card__meta">
        <Icon name="Clock" size={14} weight="regular" />
        <span>{publishLabel(ev.publishMode)}</span>
      </div>
      {onDelete ? (
        <button
          type="button"
          aria-label={`Remove ${ev.title}`}
          className="cal-card__delete"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
        >
          <Icon name="Trash" size={14} weight="regular" />
        </button>
      ) : null}
    </article>
  );
}

/**
 * Weekly content calendar (Koala "Content Calendar", Figma 8115:180083 / 10300:96762):
 * toolbar with week pager, search and filters, a result line with active-filter chips,
 * and one column per day of scheduled article events.
 */
export default function AutomationsBoard({
  weekAnchor, events, onPrevWeek, onNextWeek, onThisWeek, onAdd, onDayAdd, onEventClick, onEventDelete,
}: AutomationsBoardProps) {
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [status, setStatus] = useState<AutomationEventStatus | ''>('');
  const [mode, setMode] = useState<AutomationPublishMode | ''>('');
  const searchRef = useRef<HTMLInputElement>(null);

  const days = useMemo(() => weekDays(weekAnchor), [weekAnchor]);
  const visible = useMemo(
    () => filterEvents(events, { query, status: status || undefined, mode: mode || undefined }),
    [events, query, status, mode],
  );
  const byDay = useMemo(() => groupEventsByDay(visible), [visible]);

  const statusLabel = STATUS_OPTIONS.find((o) => o.value === status)?.label;
  const modeLabel = MODE_OPTIONS.find((o) => o.value === mode)?.label;
  const trimmed = query.trim();

  return (
    <div className="cal">
      <div className="cal-toolbar">
        <div className="cal-toolbar__group">
          <button type="button" className="cal-btn cal-btn--icon" aria-label="Previous week" onClick={onPrevWeek}>
            <Icon name="CaretLeft" size={16} weight="bold" />
          </button>
          <button type="button" className="cal-btn" onClick={onThisWeek} title="Go to this week">
            {weekRangeLabel(weekAnchor)}
          </button>
          <button type="button" className="cal-btn cal-btn--icon" aria-label="Next week" onClick={onNextWeek}>
            <Icon name="CaretRight" size={16} weight="bold" />
          </button>
        </div>

        <div className="cal-toolbar__group">
          {searchOpen ? (
            <input
              ref={searchRef}
              type="search"
              className="cal-search"
              placeholder="Search articles"
              aria-label="Search articles"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onBlur={() => { if (!query.trim()) setSearchOpen(false); }}
              onKeyDown={(e) => { if (e.key === 'Escape') { setQuery(''); setSearchOpen(false); } }}
            />
          ) : (
            <button
              type="button"
              className="cal-btn cal-btn--ghost cal-btn--icon"
              aria-label="Search articles"
              onClick={() => { setSearchOpen(true); requestAnimationFrame(() => searchRef.current?.focus()); }}
            >
              <Icon name="MagnifyingGlass" size={20} weight="regular" />
            </button>
          )}
          <span className="cal-toolbar__divider" aria-hidden="true" />
          <button type="button" className="cal-btn" onClick={onAdd}>Add event</button>
          <SelectButton label="Status" allLabel="All Statuses" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
          <SelectButton label="Publish type" allLabel="All Types" value={mode} options={MODE_OPTIONS} onChange={setMode} />
        </div>
      </div>

      <div className="cal-summary">
        <p className="cal-summary__count">
          Showing: <strong>{visible.length} Result</strong>
        </p>
        <div className="cal-summary__chips">
          {trimmed ? <FilterChip label="Search" value={trimmed} onClear={() => { setQuery(''); setSearchOpen(false); }} /> : null}
          {statusLabel ? <FilterChip label="Status" value={statusLabel} onClear={() => setStatus('')} /> : null}
          {modeLabel ? <FilterChip label="Type" value={modeLabel} onClear={() => setMode('')} /> : null}
        </div>
      </div>

      <div className="cal-board">
        {days.map((day) => {
          const key = toDateKey(day);
          const dayEvents = byDay.get(key) || [];
          return (
            <section key={key} className="cal-col" aria-label={columnDateLabel(day)}>
              <header className="cal-col__head">
                <span className="cal-col__date">{columnDateLabel(day)}</span>
                <span className="cal-col__count">{dayEvents.length}</span>
              </header>
              {dayEvents.length === 0 ? (
                <button type="button" className="cal-col__empty" onClick={() => onDayAdd(day)}>
                  <span className="cal-col__empty-title">No articles for this day</span>
                  <span className="cal-col__empty-text">There are no articles scheduled to be posted on this date.</span>
                </button>
              ) : (
                <div className="cal-col__cards">
                  {dayEvents.map((ev) => (
                    <EventCard
                      key={ev.id}
                      ev={ev}
                      onClick={onEventClick ? () => onEventClick(ev) : undefined}
                      onDelete={onEventDelete ? () => onEventDelete(ev) : undefined}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
