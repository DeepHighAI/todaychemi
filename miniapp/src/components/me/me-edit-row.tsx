/**
 * me-edit-row.tsx — 정보 수정 진입 버튼 행 (미니앱 포트)
 *
 * 웹앱 원본: src/components/me/me-edit-row.tsx
 * 미니앱: Tailwind → 인라인 스타일. lucide-react 유지.
 */

import { Pencil, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface Props {
  onClick: () => void;
}

export function MeEditRow({ onClick }: Props) {
  const t = useTranslations('me');
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        borderRadius: 'var(--r-md)',
        backgroundColor: 'var(--surface-1)',
        padding: 16,
        border: 'none',
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            display: 'flex',
            width: 44,
            height: 44,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 14,
            backgroundColor: 'var(--surface-2)',
            flexShrink: 0,
          }}
        >
          <Pencil
            style={{ width: 20, height: 20, color: 'var(--text-primary)' }}
            aria-hidden
          />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
            {t('editRow.title')}
          </div>
          <div style={{ marginTop: 2, fontSize: 12, color: 'var(--text-secondary)' }}>
            {t('editRow.sub')}
          </div>
        </div>
        <ChevronRight
          style={{ width: 20, height: 20, color: 'var(--text-secondary)', flexShrink: 0 }}
          aria-hidden
        />
      </div>
    </button>
  );
}
