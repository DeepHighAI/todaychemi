/**
 * Step1NameGender.tsx — 스텝 1: 별명 + 성별
 *
 * 웹앱 src/app/(app)/relations/new/name/page.tsx 포트.
 * next/* 제거, useTranslations 유지, Button 재사용.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { Gender } from '@/lib/relations/draft-store';

interface Step1Props {
  /** 초기값 (draft 에서 주입) */
  initialNickname: string;
  initialGender: Gender;
  /** 스텝 완료 콜백 */
  onNext: (nickname: string, gender: 'M' | 'F') => void;
}

export function Step1NameGender({ initialNickname, initialGender, onNext }: Step1Props) {
  const t = useTranslations('relations.new');

  const [nickname, setNickname] = useState(initialNickname);
  const [gender, setGender] = useState<Gender>(initialGender);

  const canAdvance = nickname.trim().length > 0 && (gender === 'M' || gender === 'F');

  function handleNext() {
    if (!canAdvance) return;
    onNext(nickname.trim(), gender as 'M' | 'F');
  }

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
        {t('step1.headline')}
      </h1>
      <p style={{ font: 'var(--t-sub)', color: 'var(--text-secondary)', margin: 0 }}>
        {t('step1.body')}
      </p>

      {/* 별명 입력 */}
      <div
        style={{
          borderRadius: 'var(--r-md)',
          backgroundColor: 'var(--card)',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <label
          htmlFor="rel-nickname"
          style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}
        >
          {t('nickname.label')}
        </label>
        <input
          id="rel-nickname"
          type="text"
          value={nickname}
          maxLength={20}
          placeholder={t('nickname.placeholder')}
          onChange={(e) => setNickname(e.target.value)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            borderRadius: 'var(--r-sm)',
            backgroundColor: 'var(--surface-1)',
            border: '1px solid var(--border)',
            padding: '12px 14px',
            fontSize: 15,
            color: 'var(--foreground)',
            outline: 'none',
          }}
        />
      </div>

      {/* 성별 선택 */}
      <div
        style={{
          borderRadius: 'var(--r-md)',
          backgroundColor: 'var(--card)',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>
          {t('gender.label')}
        </p>
        <div role="radiogroup" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {(['M', 'F'] as const).map((g) => (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={gender === g}
              onClick={() => setGender(g)}
              style={{
                padding: '10px 0',
                borderRadius: 'var(--r-pill)',
                border: 'none',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                backgroundColor: gender === g ? 'var(--p-40)' : 'var(--surface-2)',
                color: gender === g ? '#fff' : 'var(--foreground)',
              }}
            >
              {t(g === 'M' ? 'gender.male' : 'gender.female')}
            </button>
          ))}
        </div>
      </div>

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
      {/* 버튼 공간 확보 */}
      <div style={{ height: 80 }} />
    </div>
  );
}
