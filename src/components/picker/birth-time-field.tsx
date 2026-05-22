'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { MockInput } from './mock-input';
import { Tray } from './tray';
import { WheelPicker } from './wheel-picker';

interface BirthTimeFieldProps {
  value: string; // 'HH:mm' | ''
  onChange: (v: string) => void;
  label: string;
  portal?: boolean;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function BirthTimeField({ value, onChange, label, portal = true }: BirthTimeFieldProps) {
  const t = useTranslations('onboarding');

  const [open, setOpen] = useState(false);
  const [draftHour, setDraftHour] = useState(14);
  const [draftMin, setDraftMin] = useState(20);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return;
    if (value) {
      const parts = value.split(':');
      setDraftHour(Number(parts[0]));
      setDraftMin(Number(parts[1]));
    } else {
      setDraftHour(14);
      setDraftMin(20);
    }
  }, [open, value]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const hours = Array.from({ length: 24 }, (_, i) => pad(i));
  const mins = Array.from({ length: 60 }, (_, i) => pad(i));

  return (
    <>
      <MockInput
        label={label}
        value={value || null}
        placeholder={t('tray.tapToSelect')}
        onTap={() => setOpen(true)}
        filled={!!value}
      />
      <Tray
        open={open}
        title={label}
        onClose={() => setOpen(false)}
        onDone={() => {
          onChange(`${pad(draftHour)}:${pad(draftMin)}`);
          setOpen(false);
        }}
        portal={portal}
      >
        <div className="picker-cols">
          <div className="picker-band" />
          <WheelPicker
            options={hours}
            value={pad(draftHour)}
            onChange={(v) => setDraftHour(Number(v))}
            aria-label={t('tray.hourColumn')}
          />
          <span className="picker-colon">:</span>
          <WheelPicker
            options={mins}
            value={pad(draftMin)}
            onChange={(v) => setDraftMin(Number(v))}
            aria-label={t('tray.minuteColumn')}
          />
        </div>
      </Tray>
    </>
  );
}
