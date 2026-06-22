/**
 * StepHeader.tsx — 인연 등록 상단 진행 표시줄 + 이전 단계
 *
 * 웹앱 src/app/(app)/relations/new/layout.tsx 에 해당하는 로직.
 * SPA 에서는 layout 대신 각 스텝 컴포넌트에 공통 헤더로 주입한다.
 */

interface StepHeaderProps {
  /** 현재 스텝 (1-based) */
  current: number;
  /** 전체 스텝 수 */
  total: number;
  /** 뒤로가기 콜백 */
  onBack: () => void;
}

export function StepHeader({ current, total, onBack }: StepHeaderProps) {
  return (
    <header style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {current > 1 && (
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
          borderRadius: 9999,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            backgroundColor: 'var(--p-40)',
            borderRadius: 9999,
            width: `${(current / total) * 100}%`,
            transition: 'width 0.3s',
          }}
        />
      </div>
      <p style={{ font: 'var(--t-eyebrow)', color: 'var(--primary)', margin: 0 }}>
        {current} / {total}
      </p>
    </header>
  );
}
