/**
 * legal-doc-sheet.tsx — 약관/개인정보처리방침 바텀시트 (온보딩 동의 단계)
 *
 * 전체 페이지 이동(LegalPage) 대신 온보딩 진행 상태를 유지하기 위해 vaul Drawer 로
 * 문서를 노출한다. 본문은 LegalPage 와 동일한 공용 LegalDocContent 를 사용한다.
 */

import { useTranslations } from 'next-intl';

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from '@/components/ui/drawer';
import { LegalDocContent } from '@/components/legal/legal-markdown';

interface LegalDocSheetProps {
  slug: 'terms' | 'privacy' | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LegalDocSheet({ slug, open, onOpenChange }: LegalDocSheetProps) {
  const t = useTranslations('onboarding');
  const title = slug === 'privacy' ? t('consent.privacyLabel') : t('consent.termsLabel');

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
          <DrawerTitle>{title}</DrawerTitle>
          {/* Radix Dialog 접근성 계약 — 시각적으로 숨김(다른 시트와 동일 패턴) */}
          <DrawerDescription
            style={{ position: 'absolute', left: -9999, width: 1, height: 1, overflow: 'hidden' }}
          >
            {t('consent.docDescription')}
          </DrawerDescription>
          <DrawerClose
            aria-label={t('consent.close')}
            style={{
              padding: '4px 10px',
              border: 'none',
              background: 'none',
              fontSize: 13,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            {t('consent.close')}
          </DrawerClose>
        </div>
        <div style={{ padding: '4px 20px 32px', overflowY: 'auto' }}>
          {slug && <LegalDocContent slug={slug} />}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
