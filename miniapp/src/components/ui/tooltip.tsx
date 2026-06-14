/**
 * tooltip.tsx — @base-ui/react Tooltip 래퍼 (미니앱 포트)
 *
 * 웹앱 원본: src/components/ui/tooltip.tsx (@base-ui + Tailwind)
 * 미니앱: @base-ui 유지, Tailwind → 인라인 스타일.
 */

import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';
import { cn } from '@/lib/utils';

function TooltipProvider({ delay = 0, ...props }: TooltipPrimitive.Provider.Props) {
  return <TooltipPrimitive.Provider data-slot="tooltip-provider" delay={delay} {...props} />;
}

function Tooltip({ ...props }: TooltipPrimitive.Root.Props) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

function TooltipTrigger({ ...props }: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

interface TooltipContentProps extends TooltipPrimitive.Popup.Props,
  Pick<TooltipPrimitive.Positioner.Props, 'align' | 'alignOffset' | 'side' | 'sideOffset'> {
  className?: string;
}

function TooltipContent({
  className,
  side = 'top',
  sideOffset = 4,
  align = 'center',
  alignOffset = 0,
  children,
  style,
  ...props
}: TooltipContentProps & { style?: React.CSSProperties }) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        style={{ zIndex: 50, isolation: 'isolate' }}
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn('tooltip-content', className)}
          style={{
            zIndex: 50,
            display: 'inline-flex',
            maxWidth: 256,
            gap: 6,
            borderRadius: 'var(--r-sm)',
            backgroundColor: 'var(--foreground, var(--text-primary))',
            color: 'var(--background, var(--bg-canvas))',
            padding: '6px 12px',
            fontSize: 11,
            ...style,
          }}
          {...props}
        >
          {children}
          <TooltipPrimitive.Arrow style={{
            zIndex: 50,
            width: 10,
            height: 10,
            transform: 'translateY(calc(-50% - 2px)) rotate(45deg)',
            borderRadius: 2,
            backgroundColor: 'var(--foreground, var(--text-primary))',
          }} />
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
