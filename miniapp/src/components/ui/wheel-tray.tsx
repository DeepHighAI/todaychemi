/**
 * wheel-tray.tsx — 하단 슬라이드 휠 트레이 (취소/완료 헤더)
 *
 * 와이어 ref: UIDesign/interactive.jsx Tray + system.css .tray.
 * vaul 이 아닌 createPortal(document.body) 기반 — me-edit-drawer(vaul) 안에서도
 * 중첩 충돌 없이 위에 뜬다. 모션은 UIDesign .tray(translateY + cubic-bezier).
 */

import { useEffect, useState, type ReactNode } from 'react';
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

  // open 직후 다음 프레임에 translateY(0) 전환 → 슬라이드 인.
  useEffect(() => {
    if (!open) {
      setShown(false);
      return;
    }
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div>
      <div
        aria-hidden
        onClick={onCancel}
        style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 200 }}
      />
      <div
        role="dialog"
        aria-label={title}
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 201,
          maxWidth: 448,
          margin: '0 auto',
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
