/**
 * StepHeader.tsx — 온보딩 단계 헤더 (진행 바 + 단계 표시 + 뒤로가기)
 *
 * 웹앱 원본: src/app/(app)/onboarding/layout.tsx
 * 미니앱: next/navigation → props 기반 콜백, Tailwind → 인라인 스타일.
 */

import { ChevronLeft } from 'lucide-react';

const TOTAL_STEPS = 4;

interface StepHeaderProps {
  step: number; // 1-indexed
  onBack: () => void;
}

export function StepHeader({ step, onBack }: StepHeaderProps) {
  const progress = (step / TOTAL_STEPS) * 100;

  return (
    <header style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 뒤로가기 버튼 */}
      <button
        type="button"
        onClick={onBack}
        aria-label="이전 단계"
        style={{
          width: 32,
          height: 32,
          marginLeft: -4,
          borderRadius: '50%',
          border: 'none',
          background: 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'var(--foreground)',
        }}
      >
        <ChevronLeft size={22} />
      </button>

      {/* 진행 바 */}
      <div
        style={{
          height: 4,
          backgroundColor: 'var(--surface-2)',
          borderRadius: 999,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            backgroundColor: 'var(--p-40)',
            borderRadius: 999,
            width: `${progress}%`,
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      {/* 단계 텍스트 */}
      <p
        style={{
          font: 'var(--t-cap)',
          fontWeight: 700,
          color: 'var(--p-40)',
          margin: 0,
        }}
      >
        {step} / {TOTAL_STEPS}
      </p>
    </header>
  );
}
