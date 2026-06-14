/**
 * SwipeRow.tsx — 좌측 스와이프 시 빨간 삭제 버튼 노출 (미니앱 포트)
 *
 * 웹앱 원본: src/components/layout/swipe-row.tsx
 * 변경: 'use client' 제거, next-intl useTranslations 유지 (provider 마운트됨).
 * Canvas reference: type-d/screens-interactive.jsx::SwipeRow
 */

import {
  useRef,
  useState,
  useCallback,
  type ReactNode,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

// -----------------------------------------------------------------------
// 컴포넌트
// -----------------------------------------------------------------------

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

  const onStart = useCallback(
    (clientX: number, clientY: number) => {
      startRef.current = { x: clientX, y: clientY, base: revealed ? -actionWidth : 0 };
      movedRef.current = false;
      setDragging(true);
    },
    [revealed, actionWidth],
  );

  const onMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!dragging) return;
      const dxRaw = clientX - startRef.current.x + startRef.current.base;
      const dyRaw = Math.abs(clientY - startRef.current.y);
      if (Math.abs(dxRaw - startRef.current.base) > 6) movedRef.current = true;
      // 수직 스크롤이 우선 — 수직 움직임이 크면 무시
      if (dyRaw > Math.abs(dxRaw - startRef.current.base) * 1.5) return;
      setDx(Math.max(-actionWidth * 1.4, Math.min(0, dxRaw)));
    },
    [dragging, actionWidth],
  );

  const onEnd = useCallback(() => {
    if (!dragging) return;
    setDragging(false);
    if (dx < -actionWidth * 0.5) {
      setDx(-actionWidth);
      setRevealed(true);
    } else {
      setDx(0);
      setRevealed(false);
    }
  }, [dragging, dx, actionWidth]);

  const handleClick = (e: MouseEvent) => {
    if (movedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (revealed) {
      setDx(0);
      setRevealed(false);
      return;
    }
    onClick?.(e);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!onClick || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    if (revealed) {
      setDx(0);
      setRevealed(false);
      return;
    }
    onClick(e as unknown as MouseEvent);
  };

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 'var(--r-md)',
      }}
    >
      {/* 삭제 액션 버튼 (row 아래 위치) */}
      <button
        type="button"
        aria-label={t('delete')}
        onClick={(e) => {
          e.stopPropagation();
          onDelete?.();
        }}
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          width: actionWidth,
          background: 'var(--warn)',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <Trash2 size={18} />
        <span style={{ fontSize: 11, fontWeight: 700, lineHeight: 1 }}>{t('delete')}</span>
      </button>

      {/* 스와이프 콘텐츠 */}
      <div
        onTouchStart={(e) => onStart(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchMove={(e) => onMove(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchEnd={onEnd}
        onMouseDown={(e) => onStart(e.clientX, e.clientY)}
        onMouseMove={(e) => dragging && onMove(e.clientX, e.clientY)}
        onMouseUp={onEnd}
        onMouseLeave={onEnd}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        style={{
          position: 'relative',
          backgroundColor: 'var(--card)',
          cursor: onClick ? 'pointer' : undefined,
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
