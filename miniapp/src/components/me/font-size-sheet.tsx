/**
 * font-size-sheet.tsx — 글자 크기(보통/크게) 선택 바텀시트.
 *
 * 선택 즉시 use-preferences 가 <html data-font-scale> 를 갱신해 전체 UI(zoom)가
 * 라이브로 확대된다. 옵션 라벨 자체를 크기 차로 표시해 미리보기를 겸한다.
 * 패턴: legal-doc-sheet(vaul Drawer + 숨김 Description) 동일.
 */

import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from '@/components/ui/drawer';
import { usePreferences } from '@/lib/preferences/use-preferences';
import type { FontScale } from '@/lib/preferences/storage';

interface FontSizeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const OPTIONS: { value: FontScale; labelKey: 'normal' | 'large'; previewSize: number }[] = [
  { value: 'normal', labelKey: 'normal', previewSize: 15 },
  { value: 'large', labelKey: 'large', previewSize: 19 },
];

export function FontSizeSheet({ open, onOpenChange }: FontSizeSheetProps) {
  const t = useTranslations('me.fontSize');
  const fontScale = usePreferences((s) => s.fontScale);
  const setFontScale = usePreferences((s) => s.setFontScale);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            padding: '12px 20px 4px',
          }}
        >
          <DrawerTitle>{t('title')}</DrawerTitle>
          {/* Radix Dialog 접근성 계약 — 시각적으로 숨김(다른 시트와 동일 패턴) */}
          <DrawerDescription
            style={{ position: 'absolute', left: -9999, width: 1, height: 1, overflow: 'hidden' }}
          >
            {t('description')}
          </DrawerDescription>
          <DrawerClose
            aria-label={t('close')}
            style={{
              padding: '4px 10px',
              border: 'none',
              background: 'none',
              fontSize: 13,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            {t('close')}
          </DrawerClose>
        </div>

        <div style={{ padding: '4px 20px 24px' }}>
          <p style={{ font: 'var(--t-sub)', color: 'var(--text-secondary)', margin: '0 0 12px' }}>
            {t('preview')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {OPTIONS.map((opt) => {
              const active = fontScale === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  aria-current={active}
                  onClick={() => setFontScale(opt.value)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 16,
                    borderRadius: 'var(--r-md)',
                    border: active ? '2px solid var(--primary)' : '1px solid var(--hairline)',
                    background: active ? 'var(--accent)' : 'var(--bg-card)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: opt.previewSize, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {t(opt.labelKey)}
                  </span>
                  {active && <Check size={20} style={{ color: 'var(--primary)', flexShrink: 0 }} aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
