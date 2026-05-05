'use client';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { GLOSSARY_TERMS } from '@/lib/glossary/terms';
import type { GlossaryKey } from '@/types/glossary';

interface TermTooltipProps {
  term: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function TermTooltip({ term, children, defaultOpen = false }: TermTooltipProps) {
  const entry = GLOSSARY_TERMS[term as GlossaryKey];

  if (!entry) {
    return <span>{children}</span>;
  }

  return (
    <TooltipProvider>
      <Tooltip defaultOpen={defaultOpen}>
        <TooltipTrigger
          data-testid="term-tooltip-trigger"
          tabIndex={0}
          className="inline underline decoration-dotted underline-offset-2 cursor-help"
        >
          {children}
          <span className="ml-0.5 text-[10px] text-muted-foreground align-super">ⓘ</span>
        </TooltipTrigger>
        <TooltipContent className="max-w-64 space-y-1.5 p-3 text-left">
          <p className="text-xs font-medium">
            {entry.term}
            {entry.reading && (
              <span className="ml-1 text-muted-foreground font-normal">({entry.reading})</span>
            )}
          </p>
          <p className="text-xs text-balance">{entry.definition}</p>
          {entry.classic_quote && (
            <p className="text-[10px] text-muted-foreground border-t pt-1 mt-1 italic">
              &ldquo;{entry.classic_quote.original}&rdquo; — {entry.classic_quote.source}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
