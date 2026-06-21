/**
 * dialog.tsx — @base-ui/react Dialog 래퍼 (미니앱 포트)
 *
 * 웹앱 원본: src/components/ui/dialog.tsx (@base-ui + Tailwind)
 * 미니앱: @base-ui 유지, Tailwind 제거, className 미사용 (인라인 스타일만).
 */

import * as React from 'react';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({ style, ...props }: Omit<DialogPrimitive.Backdrop.Props, 'className'>) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        backgroundColor: 'rgba(0,0,0,0.1)',
        backdropFilter: 'blur(2px)',
        // 포인터-이벤트 트랩 방어: vaul Drawer 가 닫히는 ~500ms 동안 body 가
        // pointer-events:none 이어도 모달 백드롭/팝업은 항상 상호작용 가능해야 한다.
        // (base-ui 는 열린 Popup/Backdrop 에 pointer-events 를 명시하지 않아 상속됨.)
        pointerEvents: 'auto',
        ...(typeof style === 'object' && !Array.isArray(style) ? style : {}),
      }}
      {...props}
    />
  );
}

function DialogContent({
  children,
  showCloseButton = true,
  style,
  ...props
}: Omit<DialogPrimitive.Popup.Props, 'className'> & { showCloseButton?: boolean }) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 50,
          display: 'grid',
          width: 'calc(100% - 2rem)',
          maxWidth: 384,
          gap: 16,
          borderRadius: 'var(--r-xl)',
          backgroundColor: 'var(--bg-card)',
          color: 'var(--text-primary)',
          padding: 16,
          fontSize: 14,
          outline: 'none',
          // 포인터-이벤트 트랩 방어 — DialogOverlay 동일 사유(상속된 none 차단).
          pointerEvents: 'auto',
          ...(typeof style === 'object' && !Array.isArray(style) ? style : {}),
        }}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                style={{ position: 'absolute', top: 8, right: 8 }}
              />
            }
          >
            <X aria-hidden style={{ width: 16, height: 16 }} />
            <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
              닫기
            </span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  );
}

function DialogHeader({ style, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      style={{ display: 'flex', flexDirection: 'column', gap: 8, ...style }}
      {...props}
    />
  );
}

function DialogFooter({
  showCloseButton = false,
  children,
  style,
  ...props
}: React.ComponentProps<'div'> & { showCloseButton?: boolean }) {
  return (
    <div
      data-slot="dialog-footer"
      style={{
        display: 'flex',
        flexDirection: 'column-reverse',
        gap: 8,
        margin: '-16px -16px -16px',
        padding: 16,
        borderTop: '1px solid var(--hairline)',
        borderBottomLeftRadius: 'var(--r-xl)',
        borderBottomRightRadius: 'var(--r-xl)',
        backgroundColor: 'color-mix(in srgb, var(--muted) 50%, transparent)',
        ...style,
      }}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          닫기
        </DialogPrimitive.Close>
      )}
    </div>
  );
}

function DialogTitle({ style, ...props }: Omit<DialogPrimitive.Title.Props, 'className'>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      style={{ font: 'var(--t-h3)', margin: 0, ...(typeof style === 'object' && !Array.isArray(style) ? style : {}) }}
      {...props}
    />
  );
}

function DialogDescription({ style, ...props }: Omit<DialogPrimitive.Description.Props, 'className'>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      style={{ font: 'var(--t-sub)', color: 'var(--text-secondary)', ...(typeof style === 'object' && !Array.isArray(style) ? style : {}) }}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
