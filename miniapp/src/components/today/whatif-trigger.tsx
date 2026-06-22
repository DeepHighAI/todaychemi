/**
 * whatif-trigger.tsx — 또 다른 나(whatif) 진입 버튼 (미니앱 포트)
 *
 * 웹앱 원본: src/components/today/whatif-trigger.tsx
 * 변경 사항:
 *  - 'use client' 제거
 *  - WhatifSheet 는 미니앱 vaul Drawer 포트를 사용한다.
 */

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { WhatifSheet } from '@/components/whatif/whatif-sheet';

export function WhatifTrigger() {
  const t = useTranslations('whatif');
  const [open, setOpen] = useState(false);

  return (
    <div style={{ padding: '0 16px' }}>
      <button
        type="button"
        className="btn-cta"
        onClick={() => setOpen(true)}
        style={{
          width: '100%',
          backgroundColor: 'var(--primary)',
          color: 'var(--primary-foreground)',
          borderRadius: 'var(--r-lg)',
          padding: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          border: 'none',
          cursor: 'pointer',
          font: 'var(--t-body)',
          fontWeight: 600,
        }}
      >
        <Sparkles size={20} />
        <span>{t('sheet.trigger')}</span>
      </button>
      <WhatifSheet open={open} onOpenChange={setOpen} />
    </div>
  );
}
