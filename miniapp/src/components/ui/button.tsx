/**
 * button.tsx — 공용 버튼 프리미티브 (미니앱 포트)
 *
 * 웹앱 원본: src/components/ui/button.tsx (@base-ui/react + CVA + Tailwind)
 * 미니앱: @base-ui/react 유지 (package.json 이미 설치됨), CVA/Tailwind 제거.
 * 스타일은 tokens.css CSS 변수로 인라인 적용.
 */

import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link';
export type ButtonSize = 'default' | 'xs' | 'sm' | 'lg' | 'icon' | 'icon-sm' | 'icon-lg';

// 변형별 인라인 스타일 팩토리 — tokens.css 변수 참조
function variantStyle(variant: ButtonVariant): React.CSSProperties {
  switch (variant) {
    case 'default':
      return { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' };
    case 'outline':
      return {
        backgroundColor: 'transparent',
        border: '1px solid var(--border)',
        color: 'var(--foreground)',
      };
    case 'secondary':
      return { backgroundColor: 'var(--secondary)', color: 'var(--secondary-foreground)' };
    case 'ghost':
      return { backgroundColor: 'transparent', color: 'var(--foreground)' };
    case 'destructive':
      return {
        backgroundColor: 'color-mix(in srgb, var(--destructive) 10%, transparent)',
        color: 'var(--destructive)',
      };
    case 'link':
      return { backgroundColor: 'transparent', color: 'var(--primary)', textDecoration: 'underline' };
  }
}

function sizeStyle(size: ButtonSize): React.CSSProperties {
  switch (size) {
    case 'xs':    return { height: 24, padding: '0 8px', fontSize: 11, borderRadius: 'var(--r-xs)' };
    case 'sm':    return { height: 28, padding: '0 10px', fontSize: 13, borderRadius: 'var(--r-sm)' };
    case 'default': return { height: 32, padding: '0 10px', fontSize: 14, borderRadius: 'var(--r-sm)' };
    case 'lg':    return { height: 36, padding: '0 14px', fontSize: 15, borderRadius: 'var(--r-md)' };
    case 'icon':    return { width: 32, height: 32, padding: 0, borderRadius: 'var(--r-sm)' };
    case 'icon-sm': return { width: 28, height: 28, padding: 0, borderRadius: 'var(--r-xs)' };
    case 'icon-lg': return { width: 36, height: 36, padding: 0, borderRadius: 'var(--r-md)' };
  }
}

const BASE_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  fontWeight: 500,
  border: 'none',
  cursor: 'pointer',
  transition: 'opacity 0.1s',
  userSelect: 'none',
  whiteSpace: 'nowrap',
  flexShrink: 0,
};

interface ButtonProps extends Omit<ButtonPrimitive.Props, 'style'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  style?: React.CSSProperties;
}

export function Button({
  variant = 'default',
  size = 'default',
  className,
  style,
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn('btn', className)}
      style={{ ...BASE_STYLE, ...variantStyle(variant), ...sizeStyle(size), ...style }}
      {...props}
    />
  );
}

/** buttonVariants — 웹앱 호환 헬퍼. 클래스 대신 data-variant 반환 (스타일 일관성 유지) */
export function buttonVariants({ variant = 'default', size = 'default' }: {
  variant?: ButtonVariant;
  size?: ButtonSize;
} = {}): string {
  return `btn btn-${variant} btn-${size}`;
}
