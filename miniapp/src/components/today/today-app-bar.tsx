/**
 * today-app-bar.tsx — 오늘 케미 앱바 (미니앱 포트)
 *
 * 웹앱 원본: src/components/today/today-app-bar.tsx
 * 변경 사항:
 *  - 'use client' 제거 (Vite SPA)
 *  - next/link <Link href> → react-router <Link to>
 *  - next-themes useTheme 제거 — miniapp 은 시스템 다크모드만 따름(tokens.css)
 *  - 테마 토글 버튼 제거 (미니앱 단순화)
 */

import { Link } from 'react-router-dom';
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
      <Link
        to="/relations/new"
        style={{
          color: 'var(--primary)',
          font: 'var(--t-sub)',
          fontWeight: 600,
          textDecoration: 'none',
        }}
      >
        {t('add_relation')}
      </Link>
    </div>
  );
}
