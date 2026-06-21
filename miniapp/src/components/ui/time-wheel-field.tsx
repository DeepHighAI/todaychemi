/**
 * time-wheel-field.tsx — 태어난 시간 휠 필드 (시/분 2열)
 *
 * 네이티브 <input type="time"> 대체. 필드 탭 → 트레이의 시·분 휠.
 * 출력은 기존과 동일한 'HH:MM'(24시간, 1분 단위).
 */

import { useState } from 'react';

import { PickerField } from './picker-field';
import { WheelTray } from './wheel-tray';
import { WheelColumn } from './wheel-column';
import { formatTime, hourOptions, minuteOptions, pad2, parseTime, type HM } from '@/lib/datetime/wheel-options';

interface TimeWheelFieldProps {
  value: string; // 'HH:MM' | ''
  onChange: (v: string) => void;
  label: string;
  placeholder: string;
  id?: string;
}

const DEFAULT_TIME: HM = { hour: 12, minute: 0 };

export function TimeWheelField({ value, onChange, label, placeholder, id }: TimeWheelFieldProps) {
  function initialDraft(): HM {
    return parseTime(value) ?? DEFAULT_TIME;
  }

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<HM>(initialDraft);

  function openTray() {
    setDraft(initialDraft());
    setOpen(true);
  }

  function done() {
    onChange(formatTime(draft));
    setOpen(false);
  }

  return (
    <>
      <PickerField id={id} value={value} placeholder={placeholder} ariaLabel={label} onTap={openTray} />
      <WheelTray open={open} title={label} onCancel={() => setOpen(false)} onDone={done}>
        <div style={{ position: 'relative', display: 'flex', gap: 4 }}>
          <div
            aria-hidden
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              height: 40,
              background: 'var(--p-40)',
              opacity: 0.08,
              borderRadius: 8,
              pointerEvents: 'none',
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <WheelColumn
              options={hourOptions()}
              value={pad2(draft.hour)}
              onChange={(v) => setDraft((d) => ({ ...d, hour: Number(v) }))}
              ariaLabel="시"
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <WheelColumn
              options={minuteOptions()}
              value={pad2(draft.minute)}
              onChange={(v) => setDraft((d) => ({ ...d, minute: Number(v) }))}
              ariaLabel="분"
            />
          </div>
        </div>
      </WheelTray>
    </>
  );
}
