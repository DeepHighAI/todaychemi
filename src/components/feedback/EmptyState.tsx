'use client';

import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  title: string;
  body?: string;
  cta?: string;
  onCta?: () => void;
}

export function EmptyState({ title, body, cta, onCta }: EmptyStateProps) {
  return (
    <div data-testid="empty-state" className="px-4">
      <div className="bg-card rounded-[var(--r-md)] p-6 flex flex-col items-center text-center gap-3">
        <p className="font-h3 text-foreground">{title}</p>
        {body && <p className="font-sub text-muted-foreground">{body}</p>}
        {cta && onCta && (
          <Button variant="default" onClick={onCta}>
            {cta}
          </Button>
        )}
      </div>
    </div>
  );
}
