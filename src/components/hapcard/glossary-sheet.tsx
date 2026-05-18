'use client';

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
      <DrawerContent role="dialog" aria-labelledby="glossary-sheet-title" aria-describedby="glossary-sheet-desc">
        <DrawerHeader>
          <DrawerTitle id="glossary-sheet-title">
            {entry?.term}
            {entry?.reading && (
              <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                {entry.reading}
              </span>
            )}
          </DrawerTitle>
          <DrawerDescription id="glossary-sheet-desc" className="sr-only">
            {t('sheet.description')}
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-4 space-y-3">
          <p className="text-sm text-foreground whitespace-pre-line">
            {entry?.extended_definition ?? entry?.definition}
          </p>
          {entry?.classic_quote && (
            <p className="text-xs text-muted-foreground border-t pt-3 italic">
              &ldquo;{entry.classic_quote.original}&rdquo;
              <span className="ml-1 not-italic">— {entry.classic_quote.source}</span>
            </p>
          )}
          {entry?.related_terms && entry.related_terms.length > 0 && (
            <div className="border-t pt-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                {t('sheet.related_terms_label')}
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {entry.related_terms.map((rel) => (
                  <li
                    key={rel}
                    className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs text-foreground"
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
            <Button variant="outline" className="w-full" onClick={closeSheet}>
              {t('dismiss')}
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
