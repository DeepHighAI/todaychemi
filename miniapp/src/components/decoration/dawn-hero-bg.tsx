/**
 * dawn-hero-bg.tsx — Dawn 시그니처 워터컬러 배경 (미니앱 포트)
 *
 * UIDesign 원본: UIDesign/SAJU-handoff/src/components/decoration/dawn-hero-bg.tsx
 * 미니앱 변환: Tailwind className → 인라인 스타일, --el-* → --accent-*,
 *   라이트색 하드코드(#f5efe5/#ffeacc) → --dawn-* 토큰(다크 자동 전환).
 *
 * /me 히어로(220px) 배경으로 사용 — 부모 relative 컨테이너 필요.
 * prefers-reduced-motion 시 anim-dawn-* 자동 정지(tokens.css).
 */

interface DawnHeroBgProps {
  animated?: boolean;
}

export function DawnHeroBg({ animated = true }: DawnHeroBgProps) {
  return (
    <div data-testid="dawn-hero-bg" style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* 레이어1: 새벽 그라데이션 워시 (다크는 --dawn-wash-bottom 오버라이드로 전환) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, var(--bg-canvas) 0%, var(--dawn-wash-bottom) 100%)',
        }}
      />
      {/* 레이어2: 워터컬러 잉크 블롭 SVG — 풀폭 비균일 스트레치(블롭이 추상·블러라 수용) */}
      <svg
        viewBox="0 0 360 220"
        preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        aria-hidden
      >
        <defs>
          <filter id="dawn-blur-1"><feGaussianBlur stdDeviation="20" /></filter>
          <filter id="dawn-blur-2"><feGaussianBlur stdDeviation="26" /></filter>
        </defs>
        {/* 새벽 하늘 글로우 */}
        <ellipse cx="180" cy="-30" rx="240" ry="80" fill="var(--dawn-sky)" opacity="0.6" />

        {/* 5 오행 잉크 블롭 (fill = --accent-*, data-element = 테스트 훅) */}
        <g filter="url(#dawn-blur-1)">
          <ellipse
            data-element="wood"
            className={animated ? 'anim-dawn-drift-1' : undefined}
            cx="56" cy="50" rx="58" ry="46" fill="var(--accent-wood)" opacity="0.32"
          />
          <ellipse
            data-element="fire"
            className={animated ? 'anim-dawn-drift-2' : undefined}
            cx="304" cy="36" rx="68" ry="52" fill="var(--accent-fire)" opacity="0.28"
          />
        </g>
        <g filter="url(#dawn-blur-2)">
          <ellipse
            data-element="earth"
            className={animated ? 'anim-dawn-drift-2' : undefined}
            cx="180" cy="80" rx="86" ry="48" fill="var(--accent-earth)" opacity="0.20"
          />
          <ellipse
            data-element="water"
            className={animated ? 'anim-dawn-drift-1' : undefined}
            cx="96" cy="170" rx="80" ry="50" fill="var(--accent-water)" opacity="0.32"
          />
          <ellipse
            data-element="metal"
            className={animated ? 'anim-dawn-drift-2' : undefined}
            cx="290" cy="160" rx="68" ry="48" fill="var(--accent-metal)" opacity="0.34"
          />
        </g>
      </svg>
      {/* 레이어3: 종이 grain */}
      <div className="dawn-grain" />
    </div>
  );
}
