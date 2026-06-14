/**
 * term-tooltip.tsx — 명리 용어 툴팁 (미니앱 포트)
 *
 * 웹앱 원본: src/components/hapcard/primitives/term-tooltip.tsx (next-intl + @base-ui + Tailwind)
 * 미니앱: Tailwind → 인라인 스타일, 'use client' 제거.
 */

import { useTranslations } from 'next-intl';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useOptionalGlossaryContext } from '@/components/hapcard/glossary-provider';
import { GLOSSARY_TERMS } from '@/lib/glossary/terms';
import type { GlossaryKey } from '@/types/glossary';

interface TermTooltipProps {
  term: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function TermTooltip({ term, children, defaultOpen = false }: TermTooltipProps) {
  const entry = GLOSSARY_TERMS[term as GlossaryKey];
  const glossary = useOptionalGlossaryContext();
  const t = useTranslations('glossary');

  if (!entry) {
    return <span>{children}</span>;
  }

  return (
    <TooltipProvider>
      <Tooltip defaultOpen={defaultOpen}>
        <TooltipTrigger
          data-testid="term-tooltip-trigger"
          tabIndex={0}
          style={{ display: 'inline', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 2, cursor: 'help' }}
        >
          {children}
          <span style={{ marginLeft: 2, fontSize: 10, color: 'var(--text-secondary)', verticalAlign: 'super' }}>ⓘ</span>
        </TooltipTrigger>
        <TooltipContent style={{ maxWidth: 256, padding: 12, display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left' }}>
          <p style={{ fontSize: 11, fontWeight: 500, margin: 0 }}>
            {entry.term}
            {entry.reading && (
              <span style={{ marginLeft: 4, color: 'rgba(255,255,255,0.7)', fontWeight: 400 }}>({entry.reading})</span>
            )}
          </p>
          <p style={{ fontSize: 11, margin: 0 }}>{entry.definition}</p>
          {entry.classic_quote && (
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: 4, marginTop: 4, fontStyle: 'italic', margin: 0 }}>
              &ldquo;{entry.classic_quote.original}&rdquo; — {entry.classic_quote.source}
            </p>
          )}
          {glossary && (
            <button
              type="button"
              onClick={() => glossary.openSheet(term)}
              style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', fontSize: 10, fontWeight: 500, textDecoration: 'underline', color: 'rgba(255,255,255,0.9)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              {t('learn_more')}
            </button>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
