'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { MockInput } from './mock-input';
import { Tray } from './tray';
import { MiniCalendar } from './mini-calendar';
import { WheelPicker } from './wheel-picker';

interface BirthDateFieldProps {
  value: string; // 'YYYY-MM-DD' | ''
  onChange: (v: string) => void;
  label: string;
  portal?: boolean;
}

function formatDate(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function parseDate(value: string): { y: number; m: number; d: number } | null {
  if (!value) return null;
  const parts = value.split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!y || !m || !d) return null;
  return { y, m: m - 1, d };
}

function monthWrap(view: { y: number; m: number }, dir: -1 | 1) {
  let m = view.m + dir;
  let y = view.y;
  if (m < 0) { m = 11; y -= 1; }
  if (m > 11) { m = 0; y += 1; }
  return { y, m };
}

export function BirthDateField({ value, onChange, label, portal = true }: BirthDateFieldProps) {
  const t = useTranslations('onboarding');
  const currentYear = new Date().getFullYear();

  const [open, setOpen] = useState(false);
  const [trayMode, setTrayMode] = useState<'calendar' | 'yearMonth'>('calendar');
  const [view, setView] = useState({ y: 1995, m: 10 });

  useEffect(() => {
    if (!open) return;
    const parsed = parseDate(value);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setView(parsed ? { y: parsed.y, m: parsed.m } : { y: 1995, m: 10 });
  }, [open, value]);

  const parsed = parseDate(value);
  const day = parsed && parsed.y === view.y && parsed.m === view.m ? parsed.d : -1;

  const years = Array.from({ length: currentYear - 1900 + 1 }, (_, i) => String(1900 + i));
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1));

  function close() {
    setOpen(false);
    setTrayMode('calendar');
  }

  function returnToCalendar() {
    setTrayMode('calendar');
  }

  function done() {
    if (trayMode === 'yearMonth') {
      returnToCalendar();
      return;
    }
    close();
  }

  const displayValue = parsed
    ? t('calendar.selectedDate', { year: parsed.y, month: parsed.m + 1, day: parsed.d })
    : null;

  return (
    <>
      <MockInput
        label={label}
        value={displayValue}
        placeholder={t('tray.tapToSelect')}
        onTap={() => setOpen(true)}
        filled={!!value}
      />
      <Tray
        open={open}
        title={label}
        onClose={close}
        onDone={done}
        portal={portal}
      >
        {trayMode === 'calendar' ? (
          <MiniCalendar
            year={view.y}
            month={view.m}
            day={day}
            onSelect={(d) => onChange(formatDate(view.y, view.m, d))}
            onMonthChange={(dir) => setView(monthWrap(view, dir))}
            onLabelTap={() => setTrayMode('yearMonth')}
          />
        ) : (
          <>
            <div className="picker-cols">
              <div className="picker-band" />
              <WheelPicker
                options={years}
                value={String(view.y)}
                onChange={(v) => setView({ y: Number(v), m: view.m })}
                onSelect={returnToCalendar}
                aria-label={t('tray.yearColumn')}
              />
              <WheelPicker
                options={months}
                value={String(view.m + 1)}
                onChange={(v) => setView({ y: view.y, m: Number(v) - 1 })}
                onSelect={returnToCalendar}
                aria-label={t('tray.monthColumn')}
              />
            </div>
            <button type="button" onClick={returnToCalendar}>
              {t('tray.confirmYear')}
            </button>
          </>
        )}
      </Tray>
    </>
  );
}
