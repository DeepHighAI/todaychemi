/**
 * glossary-sheet.tsx — 용어 사전 바텀시트 (미니앱 포트)
 *
 * 웹앱 원본: src/components/hapcard/glossary-sheet.tsx (next-intl + vaul + Tailwind)
 * 미니앱: Tailwind → 인라인 스타일, 'use client' 제거.
 */

import { useTranslations } from 'next-intl';
import { useGlossaryContext } from '@/components/hapcard/glossary-provider';
import { GLOSSARY_TERMS } from '@/lib/glossary/terms';
import type { GlossaryKey } from '@/types/glossary';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
  DrawerFooter,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';

export function GlossarySheet() {
  const { sheetTerm, closeSheet } = useGlossaryContext();
  const t = useTranslations('glossary');
  const entry = sheetTerm ? GLOSSARY_TERMS[sheetTerm as GlossaryKey] : null;

  return (
    <Drawer open={!!sheetTerm} onOpenChange={(open) => { if (!open) closeSheet(); }}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>
            {entry?.term}
            {entry?.reading && (
              <span style={{ marginLeft: 6, fontSize: 14, fontWeight: 400, color: 'var(--text-secondary)' }}>
                {entry.reading}
              </span>
            )}
          </DrawerTitle>
          <DrawerDescription>
            <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
              {t('sheet.description')}
            </span>
          </DrawerDescription>
        </DrawerHeader>
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ font: 'var(--t-body)', color: 'var(--text-primary)', whiteSpace: 'pre-line', margin: 0 }}>
            {entry?.extended_definition ?? entry?.definition}
          </p>
          {entry?.classic_quote && (
            <p style={{
              font: 'var(--t-sub)',
              color: 'var(--text-secondary)',
              borderTop: '1px solid var(--hairline)',
              paddingTop: 12,
              fontStyle: 'italic',
              margin: 0,
            }}>
              &ldquo;{entry.classic_quote.original}&rdquo;
              <span style={{ marginLeft: 4, fontStyle: 'normal' }}>— {entry.classic_quote.source}</span>
            </p>
          )}
          {entry?.related_terms && entry.related_terms.length > 0 && (
            <div style={{ borderTop: '1px solid var(--hairline)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ font: 'var(--t-cap)', color: 'var(--text-secondary)', margin: 0 }}>
                {t('sheet.related_terms_label')}
              </p>
              <ul style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: 0, padding: 0, listStyle: 'none' }}>
                {entry.related_terms.map((rel) => (
                  <li
                    key={rel}
                    style={{
                      borderRadius: 'var(--r-pill)',
                      border: '1px solid var(--hairline)',
                      backgroundColor: 'var(--muted)',
                      padding: '2px 10px',
                      fontSize: 12,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {rel}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline" style={{ width: '100%' }} onClick={closeSheet}>
              {t('dismiss')}
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
