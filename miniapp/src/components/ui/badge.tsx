/**
 * badge.tsx — 공용 배지 프리미티브 (미니앱 포트)
 *
 * 웹앱 원본: src/components/ui/badge.tsx (@base-ui + CVA + Tailwind)
 * 미니앱: 순수 span 기반, CSS 변수 인라인 스타일.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost';

function badgeStyle(variant: BadgeVariant): React.CSSProperties {
  switch (variant) {
    case 'default':
      return { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' };
    case 'secondary':
      return { backgroundColor: 'var(--secondary)', color: 'var(--secondary-foreground)' };
    case 'destructive':
      return {
        backgroundColor: 'color-mix(in srgb, var(--destructive) 10%, transparent)',
        color: 'var(--destructive)',
      };
    case 'outline':
      return {
        backgroundColor: 'transparent',
        border: '1px solid var(--border)',
        color: 'var(--foreground)',
      };
    case 'ghost':
      return { backgroundColor: 'transparent', color: 'var(--muted-foreground)' };
  }
}

const BASE_BADGE_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 20,
  padding: '2px 8px',
  borderRadius: 'var(--r-pill)',
  fontSize: 11,
  fontWeight: 500,
  whiteSpace: 'nowrap',
  border: 'none',
  gap: 4,
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ variant = 'default', className, style, children, ...props }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn('badge', className)}
      style={{ ...BASE_BADGE_STYLE, ...badgeStyle(variant), ...style }}
      {...props}
    >
      {children}
    </span>
  );
}

export function badgeVariants({ variant = 'default' }: { variant?: BadgeVariant } = {}): string {
  return `badge badge-${variant}`;
}
