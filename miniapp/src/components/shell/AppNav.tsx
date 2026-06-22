/**
 * AppNav.tsx
 *
 * 하단 탭바 추상화 레이어.
 *
 * NOTE: TDS Navigation 바 검수 의무 여부는 채널톡 확인 대기 —
 * 이 추상화로 TDS NavigationBar 교체 가능하게 유지.
 *
 * 현재는 자체 디자인 하단 탭(오늘 / 피드 / 나)을 렌더링한다.
 */

import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';

interface NavItem {
  /** 라우트 경로 */
  to: string;
  /** 탭 레이블 */
  label: string;
  /** 탭 아이콘 (ReactNode) */
  icon: ReactNode;
}

interface AppNavProps {
  items: NavItem[];
}

const FLOATING_NAV_MAX_WIDTH = 360;
const FLOATING_NAV_SIDE_GAP = 16;
const FLOATING_NAV_BOTTOM_GAP = 10;
const FLOATING_NAV_HEIGHT = 64;
const FLOATING_NAV_PADDING = 6;
const TAB_MIN_TARGET_SIZE = 44;
const ACTIVE_PILL_WIDTH = 56;
const ACTIVE_PILL_HEIGHT = 28;

/** 하단 탭 네비게이션 바 — TDS NavigationBar 교체 진입점 */
export function AppNav({ items }: AppNavProps) {
  return (
    <nav
      role="tablist"
      aria-label="메인 탭"
      style={{
        position: 'fixed',
        bottom: `calc(env(safe-area-inset-bottom) + ${FLOATING_NAV_BOTTOM_GAP}px)`,
        left: '50%',
        width: `min(calc(100% - ${FLOATING_NAV_SIDE_GAP * 2}px), ${FLOATING_NAV_MAX_WIDTH}px)`,
        height: FLOATING_NAV_HEIGHT,
        padding: FLOATING_NAV_PADDING,
        transform: 'translateX(-50%)',
        boxSizing: 'border-box',
        background: 'color-mix(in srgb, var(--bg-card) 94%, transparent)',
        border: '1px solid var(--hairline)',
        borderRadius: 'var(--r-pill)',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        // 플로팅 탭바는 페이지 콘텐츠(z 1~10) 위, 모달/시트/오버레이(z 40~60) 아래에 둔다.
        // 그래야 모든 팝업·드로어가 탭바를 덮어 그 위로 뜬다 (요구사항: 팝업은 네비바 위로).
        zIndex: 30,
        boxShadow: 'var(--e-3)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          role="tab"
          style={({ isActive }) => ({
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            minHeight: TAB_MIN_TARGET_SIZE,
            borderRadius: 'var(--r-pill)',
            // UIDesign(M3) 활성 라벨 = --p-10/700, 비활성 = --outline/500
            color: isActive ? 'var(--p-10)' : 'var(--outline)',
            textDecoration: 'none',
            fontSize: 11,
            fontWeight: isActive ? 700 : 500,
            letterSpacing: 'var(--ls-snug)',
            paddingTop: 4,
            paddingBottom: 4,
            transition: 'color 0.15s',
          })}
          aria-selected={undefined} // NavLink 의 aria-current="page" 로 관리
        >
          {({ isActive }) => (
            <>
              {/* M3 활성 인디케이터 pill — 아이콘을 감싸는 56x28 캡슐(UIDesign system.css .tabbar .ti .ic).
                  활성 시 --p-90 배경 + --p-10 전경, 비활성 시 투명 → 아이콘은 라벨 색(--outline) 상속. */}
              <span
                style={{
                  width: ACTIVE_PILL_WIDTH,
                  height: ACTIVE_PILL_HEIGHT,
                  borderRadius: 'var(--r-pill)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isActive ? 'var(--p-90)' : 'transparent',
                  color: isActive ? 'var(--p-10)' : 'inherit',
                  transition: 'background 0.15s',
                }}
              >
                {item.icon}
              </span>
              <span>{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
