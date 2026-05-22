'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface TrayProps {
  open: boolean;
  title: string;
  onClose: () => void;
  onDone: () => void;
  children: React.ReactNode;
  cancelLabel?: string;
  doneLabel?: string;
  portal?: boolean;
}

export function Tray({
  open,
  title,
  onClose,
  onDone,
  children,
  cancelLabel = '취소',
  doneLabel = '완료',
  portal = true,
}: TrayProps) {
  const [mounted, setMounted] = useState(false);
  const trayRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    if (open && trayRef.current) {
      const first = trayRef.current.querySelector<HTMLElement>('button');
      first?.focus();
    }
  }, [open]);

  if (!mounted || !open) return null;

  const content = (
    <>
      <div
        className={`fixed inset-0 z-[79] bg-black/40 transition-opacity duration-300${open ? '' : ' opacity-0 pointer-events-none'}`}
        aria-hidden="true"
        onClick={onClose}
        data-vaul-no-drag=""
      />
      <div
        ref={trayRef}
        className={`tray${open ? ' on' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-vaul-no-drag=""
      >
        <div className="tray-head">
          <button className="done" type="button" onClick={onClose}>{cancelLabel}</button>
          <div className="ttl">{title}</div>
          <button className="done" type="button" onClick={onDone}>{doneLabel}</button>
        </div>
        <div className="tray-body" data-vaul-no-drag="">{children}</div>
      </div>
    </>
  );

  return portal ? createPortal(content, document.body) : content;
}
