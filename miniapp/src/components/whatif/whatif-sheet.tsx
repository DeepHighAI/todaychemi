/**
 * whatif-sheet.tsx — 오늘의 나는? 6모드 선택 드로어 (미니앱 포트)
 *
 * 웹앱 원본: src/components/whatif/whatif-sheet.tsx (next/navigation + Tailwind)
 * 변경: useRouter(next/navigation) → useNavigate(react-router-dom),
 *       'use client' 제거, Tailwind → 인라인 스타일.
 */

import { useNavigate } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { DIAGNOSTIC_TYPE, type DiagnosticType } from '@/types/diagnostic';

interface WhatifSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WhatifSheet({ open, onOpenChange }: WhatifSheetProps) {
  const t = useTranslations('whatif');
  const navigate = useNavigate();

  const handleSelect = (type: DiagnosticType) => {
    onOpenChange(false);
    navigate(`/whatif/${type}`);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{t('sheet.title')}</DrawerTitle>
          <DrawerDescription style={{ position: 'absolute', left: -9999, width: 1, height: 1, overflow: 'hidden' }}>
            {t('sheet.description')}
          </DrawerDescription>
        </DrawerHeader>
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Object.values(DIAGNOSTIC_TYPE).map((type) => (
            <button
              key={type}
              type="button"
              data-testid={`whatif-row-${type}`}
              onClick={() => handleSelect(type)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderRadius: 'var(--r-lg)',
                backgroundColor: 'var(--bg-card)',
                padding: 16,
                color: 'var(--text-primary)',
                font: 'var(--t-sub)',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {t(`card.${type}.title`)}
            </button>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
