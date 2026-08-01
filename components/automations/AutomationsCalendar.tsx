import React, { useMemo } from 'react';
import type { AutomationEvent } from '../../lib/types/automations';

const FONT = 'var(--font-family-primary)';
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export type AutomationsCalendarProps = {
  monthDate: Date;
  today: Date;
  events: AutomationEvent[];
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onDayClick: (date: Date) => void;
  onEventClick?: (event: AutomationEvent) => void;
};

const NavBtn = ({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) => (
  <button
    type="button"
    aria-label={label}
    onClick={onClick}
    style={{
      width: 36,
      height: 36,
      borderRadius: 12,
      border: '1px solid var(--koala-border-primary)',
      background: 'var(--koala-bg-primary)',
      color: 'var(--koala-text-primary)',
      display: 'grid',
      placeItems: 'center',
      cursor: 'var(--koala-cursor-pointing)',
    }}
  >
    {children}
  </button>
);

/**
 * Month event calendar — Figma Koala calendar (`6230:327018` / `9472:40560`).
 */
export default function AutomationsCalendar({
  monthDate,
  today,
  events,
  onPrevMonth,
  onNextMonth,
  onToday,
  onDayClick,
  onEventClick,
}: AutomationsCalendarProps) {
  const y = monthDate.getFullYear();
  const m = monthDate.getMonth();

  const byDay = useMemo(() => {
    const map = new Map<string, AutomationEvent[]>();
    for (const ev of events) {
      const key = ev.scheduledDate.slice(0, 10);
      const list = map.get(key) || [];
      list.push(ev);
      map.set(key, list);
    }
    return map;
  }, [events]);

  const cells = useMemo(() => {
    const startDow = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const out: (Date | null)[] = [];
    for (let i = 0; i < startDow; i += 1) out.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) out.push(new Date(y, m, d));
    while (out.length % 7 !== 0) out.push(null);
    while (out.length < 42) out.push(null);
    return out;
  }, [y, m]);

  return (
    <div
      style={{
        background: 'var(--koala-bg-primary)',
        border: '1px solid var(--koala-border-primary)',
        borderRadius: 16,
        overflow: 'hidden',
        fontFamily: FONT,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--koala-border-primary)',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <NavBtn label="Previous month" onClick={onPrevMonth}>
            <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0" clipRule="evenodd" />
            </svg>
          </NavBtn>
          <NavBtn label="Next month" onClick={onNextMonth}>
            <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden="true" style={{ transform: 'scaleX(-1)' }}>
              <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0" clipRule="evenodd" />
            </svg>
          </NavBtn>
          <h2 style={{ margin: '0 0 0 8px', fontSize: 18, fontWeight: 700, color: 'var(--koala-text-primary)', letterSpacing: '-0.4px' }}>
            {MONTHS_FULL[m]} {y}
          </h2>
        </div>
        <button
          type="button"
          onClick={onToday}
          style={{
            height: 36,
            padding: '0 12px',
            borderRadius: 12,
            border: '1px solid var(--koala-border-primary)',
            background: 'var(--koala-bg-primary)',
            color: 'var(--koala-text-primary)',
            fontFamily: FONT,
            fontSize: 14,
            fontWeight: 500,
            cursor: 'var(--koala-cursor-pointing)',
          }}
        >
          Today
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--koala-border-primary)' }}>
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            style={{
              padding: '10px 12px',
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--koala-text-tertiary)',
              borderRight: '1px solid var(--koala-border-primary)',
            }}
          >
            {w}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {cells.map((day, i) => {
          if (!day) {
            return (
              <div
                key={`e${i}`}
                style={{
                  minHeight: 110,
                  background: 'var(--koala-bg-secondary)',
                  borderRight: '1px solid var(--koala-border-primary)',
                  borderBottom: '1px solid var(--koala-border-primary)',
                }}
              />
            );
          }
          const key = toDateKey(day);
          const dayEvents = byDay.get(key) || [];
          const isToday = sameDay(day, today);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onDayClick(day)}
              style={{
                minHeight: 110,
                padding: 8,
                textAlign: 'left',
                verticalAlign: 'top',
                background: 'var(--koala-bg-primary)',
                borderRight: '1px solid var(--koala-border-primary)',
                borderBottom: '1px solid var(--koala-border-primary)',
                borderTop: 'none',
                borderLeft: 'none',
                cursor: 'var(--koala-cursor-pointing)',
                fontFamily: FONT,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                alignItems: 'stretch',
              }}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 9999,
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 13,
                  fontWeight: isToday ? 700 : 500,
                  color: isToday ? '#fff' : 'var(--koala-text-primary)',
                  background: isToday ? 'var(--koala-brand)' : 'transparent',
                }}
              >
                {day.getDate()}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                {dayEvents.slice(0, 3).map((ev) => (
                  <span
                    key={ev.id}
                    role={onEventClick ? 'button' : undefined}
                    tabIndex={onEventClick ? 0 : undefined}
                    onClick={(e) => {
                      if (!onEventClick) return;
                      e.stopPropagation();
                      onEventClick(ev);
                    }}
                    onKeyDown={(e) => {
                      if (!onEventClick) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        onEventClick(ev);
                      }
                    }}
                    title={`${ev.title} · ${ev.publishMode}`}
                    style={{
                      display: 'block',
                      padding: '3px 8px',
                      borderRadius: 8,
                      fontSize: 11,
                      fontWeight: 500,
                      lineHeight: '16px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      color: ev.publishMode === 'live' ? '#fff' : 'var(--koala-text-primary)',
                      background:
                        ev.publishMode === 'live'
                          ? 'var(--koala-brand)'
                          : 'var(--koala-bg-secondary)',
                      border: ev.publishMode === 'live' ? 'none' : '1px solid var(--koala-border-primary)',
                    }}
                  >
                    {ev.title}
                  </span>
                ))}
                {dayEvents.length > 3 ? (
                  <span style={{ fontSize: 11, color: 'var(--koala-text-tertiary)', paddingLeft: 4 }}>
                    +{dayEvents.length - 3} more
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { toDateKey, MONTHS_FULL };
