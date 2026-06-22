/**
 * Step2DobTime.tsx — 스텝 2: 생년월일 + 양음력 + 출생시간
 *
 * 웹앱 src/app/(app)/relations/new/dob-time/page.tsx 포트.
 * - 생년월일/시간 = iOS 휠 피커(DateWheelField/TimeWheelField). 출력 shape
 *   (YYYY-MM-DD / HH:MM)·검증은 네이티브 input 과 동일하게 유지.
 * - G-10 (ADR-029 Amend): "생일을 잘 몰라요" 토글 → Track B 카드 (등록 비차단).
 *   Track B 링크 = /whatif/first_meet (라우터 Link).
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { DateWheelField } from '@/components/ui/date-wheel-field';
import { TimeWheelField } from '@/components/ui/time-wheel-field';
import type { Calendar, TimeAccuracy } from '@/lib/relations/draft-store';
import { Seg } from '@/components/ui/seg';

interface Step2Props {
  initialBirthDate: string;
  initialCalendar: Calendar;
  initialKnowledge: TimeAccuracy;
  initialBirthTime: string;
  onNext: (opts: {
    birthDate: string;
    calendar: Calendar;
    knowledge: TimeAccuracy;
    birthTime: string;
  }) => void;
}

export function Step2DobTime({
  initialBirthDate,
  initialCalendar,
  initialKnowledge,
  initialBirthTime,
  onNext,
}: Step2Props) {
  const t = useTranslations('relations.new');

  const [birthDate, setBirthDate] = useState(initialBirthDate);
  const [calendar, setCalendar] = useState<Calendar>(initialCalendar);
  const [knowledge, setKnowledge] = useState<TimeAccuracy>(initialKnowledge);
  const [birthTime, setBirthTime] = useState(initialBirthTime);
  const [showTrackB, setShowTrackB] = useState(false);

  // 시간 미상인 경우는 통과, 그 외에는 시간 입력 필수
  const canAdvance = !!birthDate && (knowledge === 'unknown' || !!birthTime);

  function handleNext() {
    if (!canAdvance) return;
    onNext({ birthDate, calendar, knowledge, birthTime });
  }

  const ACCURACY_OPTIONS: { value: TimeAccuracy; labelKey: string }[] = [
    { value: 'exact', labelKey: 'birth.timeAccuracy.exact' },
    { value: 'approximate', labelKey: 'birth.timeAccuracy.estimated' },
    { value: 'unknown', labelKey: 'birth.timeAccuracy.unknown' },
  ];

  return (
    <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h1
        style={{
          font: 'var(--t-h1)',
          letterSpacing: 'var(--ls-tight)',
          color: 'var(--foreground)',
          whiteSpace: 'pre-line',
          margin: 0,
        }}
      >
        {t('step2.headline')}
      </h1>

      <div
        style={{
          borderRadius: 'var(--r-md)',
          backgroundColor: 'var(--card)',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* 양력 / 음력 선택 (공용 Seg) */}
        <Seg
          options={[
            { value: 'solar', label: t('birth.calendarSolar') },
            { value: 'lunar', label: t('birth.calendarLunar') },
          ]}
          value={calendar}
          onChange={(v) => setCalendar(v)}
          variant="fill"
          columns={2}
          ariaLabel="양력·음력"
        />

        {/* 생년월일 — 휠 피커 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label
            htmlFor="rel-birthdate"
            style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}
          >
            {t('birth.date')}
          </label>
          <DateWheelField
            id="rel-birthdate"
            value={birthDate}
            onChange={setBirthDate}
            min="1900-01-01"
            max={new Date().toISOString().slice(0, 10)}
            label={t('birth.date')}
            placeholder={t('birth.datePlaceholder')}
          />
        </div>

        {/* 시간 인지도 (공용 Seg — outlined fill) */}
        <Seg
          options={ACCURACY_OPTIONS.map(({ value, labelKey }) => ({
            value,
            label: t(labelKey as Parameters<typeof t>[0]),
          }))}
          value={knowledge}
          onChange={(v) => setKnowledge(v)}
          variant="fill"
          columns={3}
          shape="rounded"
          outlined
          size="sm"
          ariaLabel="출생 시간 정확도"
        />

        {/* 시간 입력 — 휠 피커 */}
        {knowledge !== 'unknown' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label
              htmlFor="rel-birthtime"
              style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}
            >
              {t('birth.timeOptional')}
            </label>
            <TimeWheelField
              id="rel-birthtime"
              value={birthTime}
              onChange={setBirthTime}
              label={t('birth.timeOptional')}
              placeholder={t('birth.timePlaceholder')}
            />
          </div>
        )}

        {knowledge === 'unknown' && (
          <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>
            {t('birth.timeUnknownHint')}
          </p>
        )}
      </div>

      {/* G-10 Track B: "생일을 잘 몰라요" 토글 */}
      <button
        type="button"
        aria-expanded={showTrackB}
        onClick={() => setShowTrackB((v) => !v)}
        style={{
          background: 'none',
          border: 'none',
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--text-secondary)',
          textDecoration: 'underline',
          textUnderlineOffset: 2,
          cursor: 'pointer',
          padding: 0,
          alignSelf: 'flex-start',
        }}
      >
        {t('birth.unknownBirthday')}
      </button>

      {showTrackB && (
        <div
          style={{
            borderRadius: 'var(--r-md)',
            backgroundColor: 'var(--surface-2)',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
            {t('birth.trackB.title')}
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
            {t('birth.trackB.body')}
          </p>
          {/* 라우터 Link — /whatif/first_meet */}
          <Link
            to="/whatif/first_meet"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--p-40)',
              textDecoration: 'none',
            }}
          >
            {t('birth.trackB.cta')} →
          </Link>
        </div>
      )}

      {/* 고정 하단 버튼 */}
      <div
        style={{
          position: 'fixed',
          bottom: 16,
          left: 16,
          right: 16,
          maxWidth: 448,
          margin: '0 auto',
        }}
      >
        <Button
          onClick={handleNext}
          disabled={!canAdvance}
          variant="default"
          style={{ height: 48, width: '100%', borderRadius: 'var(--r-pill)', fontWeight: 700 }}
        >
          {t('next')}
        </Button>
      </div>
      <div style={{ height: 80 }} />
    </div>
  );
}
