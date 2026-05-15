'use client';

import { useTranslations } from 'next-intl';

interface MiniCalendarProps {
  year: number;
  month: number; // 0-indexed
  day: number;   // 1..31, -1 = none selected
  onSelect: (d: number) => void;
  onMonthChange: (dir: -1 | 1) => void;
  onLabelTap: () => void;
}

const WEEKDAY_KEYS = [
  'calendar.weekday.sun',
  'calendar.weekday.mon',
  'calendar.weekday.tue',
  'calendar.weekday.wed',
  'calendar.weekday.thu',
  'calendar.weekday.fri',
  'calendar.weekday.sat',
] as const;

export function MiniCalendar({ year, month, day, onSelect, onMonthChange, onLabelTap }: MiniCalendarProps) {
  const t = useTranslations('onboarding');

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length < 42) cells.push(null);

  return (
    <div>
      <div className="cal-head">
        <button type="button" onClick={() => onMonthChange(-1)}>‹</button>
        <button type="button" className="mo" onClick={onLabelTap}>
          {t('calendar.monthLabel', { year, month: month + 1 })}
        </button>
        <button type="button" onClick={() => onMonthChange(1)}>›</button>
      </div>
      <div className="cal">
        {WEEKDAY_KEYS.map((k) => (
          <div key={k} className="h">{t(k)}</div>
        ))}
        {cells.map((d, i) =>
          d === null ? (
            <div key={`cell-${i}`} className="d muted" />
          ) : (
            <div
              key={`cell-${i}`}
              className={`d${d === day ? ' sel' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(d)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(d);
                }
              }}
            >
              {d}
            </div>
          )
        )}
      </div>
    </div>
  );
}
