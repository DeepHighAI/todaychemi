/**
 * today-app-bar.tsx — 오늘 케미 앱바 (미니앱 포트)
 *
 * 웹앱 원본: src/components/today/today-app-bar.tsx
 * 변경 사항:
 *  - 'use client' 제거 (Vite SPA)
 *  - 우측 인연 등록 링크 제거. 홈 인연 등록 진입은 중앙 빠른카드·0건 hero 로 유지한다.
 *  - 비게임 출시 가이드 라이트 모드 기준에 맞춰 테마 토글은 렌더하지 않는다.
 */

import { useTranslations } from 'next-intl';

export function TodayAppBar() {
  const t = useTranslations('home');

  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 40,
      backgroundColor: 'var(--surface-1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      height: 56,
    }}>
      <h1 style={{ font: 'var(--t-h3)', color: 'var(--text-primary)', margin: 0 }}>
        {t('greeting')}
      </h1>
    </div>
  );
}
