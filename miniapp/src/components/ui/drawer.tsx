/**
 * drawer.tsx — vaul Drawer 래퍼 (미니앱 포트)
 *
 * 웹앱 원본: src/components/ui/drawer.tsx (vaul + Tailwind)
 * 미니앱: vaul 유지 (package.json 이미 설치됨), Tailwind 클래스 → 인라인 스타일.
 * 'use client' 지시어 제거 (Vite SPA — 모든 코드가 클라이언트).
 */

import * as React from 'react';
import { Drawer as DrawerPrimitive } from 'vaul';
import { cn } from '@/lib/utils';

function Drawer({ ...props }: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  return <DrawerPrimitive.Root data-slot="drawer" {...props} />;
}

function DrawerTrigger({ ...props }: React.ComponentProps<typeof DrawerPrimitive.Trigger>) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

function DrawerPortal({ ...props }: React.ComponentProps<typeof DrawerPrimitive.Portal>) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />;
}

function DrawerClose({ ...props }: React.ComponentProps<typeof DrawerPrimitive.Close>) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />;
}

function DrawerOverlay({ className, style, ...props }: React.ComponentProps<typeof DrawerPrimitive.Overlay>) {
  return (
    <DrawerPrimitive.Overlay
      data-slot="drawer-overlay"
      className={cn('drawer-overlay', className)}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        backgroundColor: 'rgba(0,0,0,0.1)',
        backdropFilter: 'blur(2px)',
        ...style,
      }}
      {...props}
    />
  );
}

function DrawerContent({ className, children, style, ...props }: React.ComponentProps<typeof DrawerPrimitive.Content>) {
  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DrawerPrimitive.Content
        data-slot="drawer-content"
        className={cn('drawer-content', className)}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--popover, var(--bg-card))',
          color: 'var(--popover-foreground, var(--text-primary))',
          borderTopLeftRadius: 'var(--r-xl)',
          borderTopRightRadius: 'var(--r-xl)',
          maxHeight: '80vh',
          overflowY: 'auto',
          ...style,
        }}
        {...props}
      >
        {/* 드래그 핸들 */}
        <div style={{
          margin: '16px auto 0',
          width: 100,
          height: 4,
          borderRadius: 'var(--r-pill)',
          backgroundColor: 'var(--muted)',
          flexShrink: 0,
        }} />
        {children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  );
}

function DrawerHeader({ className, style, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="drawer-header"
      className={cn('drawer-header', className)}
      style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: 16, textAlign: 'center', ...style }}
      {...props}
    />
  );
}

function DrawerFooter({ className, style, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn('drawer-footer', className)}
      style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: 16, ...style }}
      {...props}
    />
  );
}

function DrawerTitle({ className, style, ...props }: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn('drawer-title', className)}
      style={{ font: 'var(--t-h3)', color: 'var(--text-primary)', margin: 0, ...style }}
      {...props}
    />
  );
}

function DrawerDescription({ className, style, ...props }: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn('drawer-description', className)}
      style={{ font: 'var(--t-sub)', color: 'var(--text-secondary)', ...style }}
      {...props}
    />
  );
}

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
};
