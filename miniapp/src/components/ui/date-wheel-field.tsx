/**
 * date-wheel-field.tsx — 생년월일 휠 필드 (연/월/일 3열)
 *
 * 네이티브 <input type="date"> 대체. 필드 탭 → 트레이의 연·월·일 휠.
 * 출력은 기존과 동일한 'YYYY-MM-DD'. min/max 검증·일자 보정은 wheel-options
 * 순수 로직(clampDay/clampDateToBounds)으로 보존한다.
 */

import { useState } from 'react';

import { PickerField } from './picker-field';
import { WheelTray } from './wheel-tray';
import { WheelColumn } from './wheel-column';
import {
  clampDateToBounds,
  clampDay,
  dayOptions,
  formatDate,
  monthOptions,
  pad2,
  parseDate,
  yearOptions,
  type YMD,
} from '@/lib/datetime/wheel-options';

interface DateWheelFieldProps {
  value: string; // 'YYYY-MM-DD' | ''
  onChange: (v: string) => void;
  min: string; // 'YYYY-MM-DD'
  max: string; // 'YYYY-MM-DD'
  label: string;
  placeholder: string;
  id?: string;
}

const FALLBACK_MIN: YMD = { year: 1900, month: 1, day: 1 };
const FALLBACK_MAX: YMD = { year: new Date().getFullYear(), month: 12, day: 31 };

export function DateWheelField({ value, onChange, min, max, label, placeholder, id }: DateWheelFieldProps) {
  const minYmd = parseDate(min) ?? FALLBACK_MIN;
  const maxYmd = parseDate(max) ?? FALLBACK_MAX;

  function initialDraft(): YMD {
    const parsed = parseDate(value);
    if (parsed) return clampDay(parsed);
    // 빈 값이면 생년월일에 흔한 ~30년 전을 기본값으로(경계 보정).
    const defaultYear = Math.min(maxYmd.year, Math.max(minYmd.year, maxYmd.year - 30));
    return clampDateToBounds({ year: defaultYear, month: 1, day: 1 }, minYmd, maxYmd);
  }

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<YMD>(initialDraft);

  function openTray() {
    setDraft(initialDraft());
    setOpen(true);
  }

  function done() {
    const final = clampDateToBounds(clampDay(draft), minYmd, maxYmd);
    onChange(formatDate(final));
    setOpen(false);
  }

  const yearOpts = yearOptions(minYmd.year, maxYmd.year);
  const dayOpts = dayOptions(draft.year, draft.month);

  return (
    <>
      <PickerField
        id={id}
        value={value ? value.replaceAll('-', '.') : ''}
        placeholder={placeholder}
        ariaLabel={label}
        onTap={openTray}
      />
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
              options={yearOpts}
              value={String(draft.year)}
              onChange={(v) => setDraft((d) => clampDay({ ...d, year: Number(v) }))}
              ariaLabel="년"
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <WheelColumn
              options={monthOptions()}
              value={pad2(draft.month)}
              onChange={(v) => setDraft((d) => clampDay({ ...d, month: Number(v) }))}
              ariaLabel="월"
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <WheelColumn
              options={dayOpts}
              value={pad2(draft.day)}
              onChange={(v) => setDraft((d) => ({ ...d, day: Number(v) }))}
              ariaLabel="일"
            />
          </div>
        </div>
      </WheelTray>
    </>
  );
}
