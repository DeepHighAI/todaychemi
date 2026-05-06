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
    <div
      data-testid="empty-state"
      className="flex flex-col items-center text-center py-12 px-4 space-y-3"
    >
      <p className="text-base font-semibold text-foreground">{title}</p>
      {body && <p className="text-sm text-muted-foreground">{body}</p>}
      {cta && onCta && (
        <Button variant="default" onClick={onCta}>
          {cta}
        </Button>
      )}
    </div>
  );
}
