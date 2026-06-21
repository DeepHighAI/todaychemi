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

/** 하단 탭 네비게이션 바 — TDS NavigationBar 교체 진입점 */
export function AppNav({ items }: AppNavProps) {
  return (
    <nav
      role="tablist"
      aria-label="메인 탭"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 'var(--tabbar-h)',
        // safe-area-inset-bottom 을 추가로 확보 (iOS 홈 인디케이터)
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: 'var(--bg-card)',
        borderTop: '1px solid var(--hairline)',
        display: 'flex',
        alignItems: 'stretch',
        // 탭바는 페이지 콘텐츠(z 1~10) 위, 모달/시트/오버레이(z 40~60) 아래에 둔다.
        // 그래야 모든 팝업·드로어가 탭바를 덮어 그 위로 뜬다 (요구사항: 팝업은 네비바 위로).
        zIndex: 30,
        boxShadow: 'var(--e-2)',
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
            gap: 4,
            // UIDesign(M3) 활성 라벨 = --p-10/700, 비활성 = --outline/500
            color: isActive ? 'var(--p-10)' : 'var(--outline)',
            textDecoration: 'none',
            fontSize: 11,
            fontWeight: isActive ? 700 : 500,
            letterSpacing: 'var(--ls-snug)',
            paddingTop: 8,
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
                  width: 56,
                  height: 28,
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
