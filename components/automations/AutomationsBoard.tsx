import React, { useMemo } from 'react';
import type { AutomationEvent } from '@/src/core/shared/types/automations';
import {
  weekDays, groupEventsByDay, weekRangeLabel, toDateKey, statusBadge, publishLabel,
  WEEKDAY_LABELS, type BadgeTone,
} from '@/src/core/domain/automations/board';
import { Icon } from '../koala/icons/Icon';

const FONT = 'var(--font-family-primary)';
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const TONE_STYLE: Record<BadgeTone, { color: string; bg: string }> = {
  neutral: { color: 'var(--koala-text-secondary)', bg: 'var(--koala-bg-secondary)' },
  warning: { color: 'var(--koala-status-warning)', bg: 'var(--koala-status-warning-bg)' },
  success: { color: 'var(--koala-status-success)', bg: 'var(--koala-status-success-bg)' },
  brand: { color: 'var(--koala-text-brand)', bg: 'var(--koala-bg-secondary)' },
  danger: { color: 'var(--koala-status-danger)', bg: 'var(--koala-status-danger-bg)' },
};

export type AutomationsBoardProps = {
  weekAnchor: Date;
  today: Date;
  events: AutomationEvent[];
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  onDayAdd: (date: Date) => void;
  onEventClick?: (event: AutomationEvent) => void;
  onEventDelete?: (event: AutomationEvent) => void;
};

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const IconBtn = ({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) => (
  <button type="button" aria-label={label} onClick={onClick} className="automations-navbtn">{children}</button>
);

function EventCard({ ev, onClick, onDelete }: { ev: AutomationEvent; onClick?: () => void; onDelete?: () => void }) {
  const badge = statusBadge(ev.status);
  const tone = TONE_STYLE[badge.tone];
  const clickable = !!onClick && ev.articleId != null;
  return (
    <div
      className="automations-card"
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? onClick : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } } : undefined}
      style={{ cursor: clickable ? 'var(--koala-cursor-pointing)' : 'default' }}
    >
      <div className="automations-card__top">
        <span className="automations-badge" style={{ color: tone.color, background: tone.bg }}>
          <span className="automations-badge__dot" style={{ background: tone.color }} aria-hidden="true" />
          {badge.label}
        </span>
        {onDelete ? (
          <button
            type="button"
            aria-label="Remove event"
            className="automations-card__del"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            <Icon name="Trash" size={14} />
          </button>
        ) : null}
      </div>
      <p className="automations-card__title">{ev.title}</p>
      <div className="automations-card__meta">
        <Icon name={ev.publishMode === 'live' ? 'Globe' : 'FileText'} size={13} />
        <span>{publishLabel(ev.publishMode)}</span>
        {ev.targetKeyword ? <span className="automations-card__kw">· {ev.targetKeyword}</span> : null}
      </div>
    </div>
  );
}

/**
 * Weekly content-calendar kanban: one column per day (Mon–Sun), scheduled article events
 * as cards. Modelled on the Koala Content Calendar (Figma 8115:180083 / 10300:96762) but
 * driven by real automation events. Add per day, open the linked article, or remove.
 */
export default function AutomationsBoard({
  weekAnchor, today, events, onPrevWeek, onNextWeek, onToday, onDayAdd, onEventClick, onEventDelete,
}: AutomationsBoardProps) {
  const days = useMemo(() => weekDays(weekAnchor), [weekAnchor]);
  const byDay = useMemo(() => groupEventsByDay(events), [events]);

  return (
    <div style={{ fontFamily: FONT }}>
      <div className="automations-toolbar">
        <div className="automations-toolbar__nav">
          <IconBtn label="Previous week" onClick={onPrevWeek}>
            <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0" clipRule="evenodd" /></svg>
          </IconBtn>
          <span className="automations-toolbar__label">{weekRangeLabel(weekAnchor)}</span>
          <IconBtn label="Next week" onClick={onNextWeek}>
            <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden="true" style={{ transform: 'scaleX(-1)' }}><path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0" clipRule="evenodd" /></svg>
          </IconBtn>
          <button type="button" className="automations-today" onClick={onToday}>Today</button>
        </div>
        <span className="automations-toolbar__count">
          Showing: {events.length} {events.length === 1 ? 'result' : 'results'}
        </span>
      </div>

      <div className="automations-board">
        {days.map((day, i) => {
          const key = toDateKey(day);
          const dayEvents = byDay.get(key) || [];
          const isToday = sameDay(day, today);
          return (
            <section key={key} className={`automations-col${isToday ? ' automations-col--today' : ''}`}>
              <header className="automations-col__head">
                <div className="automations-col__day">
                  <span className="automations-col__dow">{WEEKDAY_LABELS[i]}</span>
                  <span className="automations-col__date">{day.getDate()} {MONTHS_SHORT[day.getMonth()]}</span>
                </div>
                <span className="automations-col__count" aria-label={`${dayEvents.length} events`}>{dayEvents.length}</span>
              </header>
              <div className="automations-col__body">
                {dayEvents.length === 0 ? (
                  <p className="automations-col__empty">No articles for this day</p>
                ) : (
                  dayEvents.map((ev) => (
                    <EventCard
                      key={ev.id}
                      ev={ev}
                      onClick={onEventClick ? () => onEventClick(ev) : undefined}
                      onDelete={onEventDelete ? () => onEventDelete(ev) : undefined}
                    />
                  ))
                )}
                <button type="button" className="automations-col__add" onClick={() => onDayAdd(day)}>
                  <Icon name="Plus" size={14} /> Add
                </button>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
