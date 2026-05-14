'use client';

/* SwipeRow — 좌측 스와이프 시 빨간 삭제 버튼 노출
 * Canvas reference: type-d/screens-interactive.jsx::SwipeRow
 *
 * 사용:
 *   <SwipeRow onDelete={() => mutate(...)} onClick={() => router.push(...)}>
 *     <div className="card">...</div>
 *   </SwipeRow>
 */

import { useRef, useState, useCallback, type ReactNode, type MouseEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface SwipeRowProps {
  children: ReactNode;
  onDelete?: () => void;
  onClick?: (e: MouseEvent) => void;
  actionWidth?: number;
}

export function SwipeRow({ children, onDelete, onClick, actionWidth = 84 }: SwipeRowProps) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const startRef = useRef({ x: 0, y: 0, base: 0 });
  const movedRef = useRef(false);
  const t = useTranslations('common');

  const onStart = useCallback((clientX: number, clientY: number) => {
    startRef.current = { x: clientX, y: clientY, base: revealed ? -actionWidth : 0 };
    movedRef.current = false;
    setDragging(true);
  }, [revealed, actionWidth]);

  const onMove = useCallback((clientX: number, clientY: number) => {
    if (!dragging) return;
    const dxRaw = clientX - startRef.current.x + startRef.current.base;
    const dyRaw = Math.abs(clientY - startRef.current.y);
    if (Math.abs(dxRaw - startRef.current.base) > 6) movedRef.current = true;
    // ignore mostly-vertical drags so page scroll wins
    if (dyRaw > Math.abs(dxRaw - startRef.current.base) * 1.5) return;
    setDx(Math.max(-actionWidth * 1.4, Math.min(0, dxRaw)));
  }, [dragging, actionWidth]);

  const onEnd = useCallback(() => {
    if (!dragging) return;
    setDragging(false);
    if (dx < -actionWidth * 0.5) { setDx(-actionWidth); setRevealed(true); }
    else { setDx(0); setRevealed(false); }
  }, [dragging, dx, actionWidth]);

  const handleClick = (e: MouseEvent) => {
    if (movedRef.current) { e.preventDefault(); e.stopPropagation(); return; }
    if (revealed) { setDx(0); setRevealed(false); return; }
    onClick?.(e);
  };

  return (
    <div className="relative overflow-hidden rounded-[var(--r-md)]">
      {/* delete action (sits under row) */}
      <button
        type="button"
        aria-label={t('delete')}
        onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
        className="absolute right-0 top-0 bottom-0 flex flex-col items-center justify-center gap-1 text-white"
        style={{ width: actionWidth, background: 'var(--warn)' }}
      >
        <Trash2 size={18} />
        <span className="text-[11px] font-bold leading-none">{t('delete')}</span>
      </button>

      <div
        onTouchStart={(e) => onStart(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchMove={(e) => onMove(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchEnd={onEnd}
        onMouseDown={(e) => onStart(e.clientX, e.clientY)}
        onMouseMove={(e) => dragging && onMove(e.clientX, e.clientY)}
        onMouseUp={onEnd}
        onMouseLeave={onEnd}
        onClick={handleClick}
        className="relative bg-card"
        style={{
          transform: `translateX(${dx}px)`,
          transition: dragging ? 'none' : 'transform 0.22s cubic-bezier(0.32, 0.72, 0, 1)',
          zIndex: 1,
        }}
      >
        {children}
      </div>
    </div>
  );
}
