/**
 * StepHeader.tsx — 온보딩 단계 헤더 (진행 바 + 단계 표시 + 이전 단계)
 *
 * 웹앱 원본: src/app/(app)/onboarding/layout.tsx
 * 미니앱: next/navigation → props 기반 콜백, Tailwind → 인라인 스타일.
 */

const TOTAL_STEPS = 4;

interface StepHeaderProps {
  step: number; // 1-indexed
  onBack: () => void;
}

export function StepHeader({ step, onBack }: StepHeaderProps) {
  const progress = (step / TOTAL_STEPS) * 100;

  return (
    <header style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {step > 1 && (
        <button
          type="button"
          onClick={onBack}
          style={{
            alignSelf: 'flex-start',
            minHeight: 36,
            border: 'none',
            background: 'transparent',
            color: 'var(--text-secondary)',
            font: 'var(--t-sub)',
            fontWeight: 700,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          이전 단계
        </button>
      )}

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
