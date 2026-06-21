/**
 * wheel-tray.tsx — 하단 슬라이드 휠 트레이 (취소/완료 헤더)
 *
 * 와이어 ref: UIDesign/interactive.jsx Tray + system.css .tray.
 * vaul 이 아닌 createPortal(document.body) 기반 — me-edit-drawer(vaul) 안에서도
 * 중첩 충돌 없이 위에 뜬다. 모션은 UIDesign .tray(translateY + cubic-bezier).
 */

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';

interface WheelTrayProps {
  open: boolean;
  title: string;
  onCancel: () => void;
  onDone: () => void;
  children: ReactNode;
}

export function WheelTray({ open, title, onCancel, onDone, children }: WheelTrayProps) {
  const t = useTranslations('common');
  const [shown, setShown] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const prevFocus = useRef<HTMLElement | null>(null);

  // open 직후 다음 프레임에 translateY(0) 전환 → 슬라이드 인.
  useEffect(() => {
    if (!open) {
      setShown(false);
      return;
    }
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  // 포커스 관리: open 시 다이얼로그로 이동, close 시 트리거로 복원.
  useEffect(() => {
    if (!open) return;
    prevFocus.current = document.activeElement as HTMLElement | null;
    const id = requestAnimationFrame(() => dialogRef.current?.focus());
    return () => {
      cancelAnimationFrame(id);
      prevFocus.current?.focus?.();
    };
  }, [open]);

  // Escape = 취소, Tab = 다이얼로그 내 순환(포커스 트랩).
  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
      return;
    }
    if (e.key !== 'Tab') return;
    const root = dialogRef.current;
    if (!root) return;
    const focusables = root.querySelectorAll<HTMLElement>('button, [tabindex]:not([tabindex="-1"])');
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  if (!open) return null;

  return createPortal(
    <div>
      <div
        aria-hidden
        onClick={onCancel}
        style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 200, pointerEvents: 'auto' }}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 201,
          maxWidth: 448,
          margin: '0 auto',
          // vaul modal Drawer 안에서 body 가 pointer-events:none 가 되므로
          // 포털된 트레이가 죽지 않도록 명시적으로 auto 로 되돌린다(다른 화면 무영향).
          pointerEvents: 'auto',
          backgroundColor: 'var(--bg-card)',
          borderTopLeftRadius: 'var(--r-xl)',
          borderTopRightRadius: 'var(--r-xl)',
          boxShadow: '0 -8px 24px rgba(0,0,0,0.12)',
          transform: shown ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: '1px solid var(--hairline)',
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            style={{ border: 'none', background: 'transparent', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: '4px 8px' }}
          >
            {t('cancel')}
          </button>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</span>
          <button
            type="button"
            onClick={onDone}
            style={{ border: 'none', background: 'transparent', color: 'var(--p-40)', fontSize: 14, fontWeight: 700, cursor: 'pointer', padding: '4px 8px' }}
          >
            {t('done')}
          </button>
        </div>
        <div style={{ padding: 12 }}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
