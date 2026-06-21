/**
 * back-button.tsx — 공용 뒤로가기 아이콘 버튼 (Phase 6 드리프트 통합)
 *
 * 미니앱 곳곳의 백 버튼이 글리프(ChevronLeft/←/‹)·히트영역(32 vs 44)·색 토큰
 * (--foreground vs --text-primary)·aria 라벨(이전 단계/back/뒤로)이 제각각이었다.
 * 이 단일 컴포넌트로 통일한다: lucide ChevronLeft · 44pt 히트영역 · --text-primary ·
 * aria '뒤로'. onClick 미제공 시 navigate(-1) 기본 동작(AppShell 네이티브 백 브리지와 일치).
 */

import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface BackButtonProps {
  /** 클릭 동작. 미제공 시 navigate(-1). */
  onClick?: () => void;
  /** 접근성 라벨. 기본 '뒤로'. */
  ariaLabel?: string;
  /** 글리프 크기(px). 기본 22. */
  size?: number;
  /** 인라인 스타일 병합(예: marginLeft 음수 인셋 조정). */
  style?: React.CSSProperties;
}

export function BackButton({ onClick, ariaLabel = '뒤로', size = 22, style }: BackButtonProps) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={onClick ?? (() => navigate(-1))}
      aria-label={ariaLabel}
      style={{
        // 44pt 최소 히트영역(a11y). 투명 버튼이라 보이는 건 글리프뿐이며,
        // marginLeft -4 로 컨테이너 좌측 패딩 가장자리에 글리프를 광학 정렬한다(기존 백버튼과 동일 인셋).
        width: 44,
        height: 44,
        marginLeft: -4,
        borderRadius: '50%',
        border: 'none',
        background: 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: 'var(--text-primary)',
        flexShrink: 0,
        ...style,
      }}
    >
      <ChevronLeft size={size} />
    </button>
  );
}
