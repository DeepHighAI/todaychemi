/**
 * whatif-trigger.tsx — 오늘의 나는?(whatif) 진입 버튼 (미니앱 포트)
 *
 * 웹앱 원본: src/components/today/whatif-trigger.tsx
 * 변경 사항:
 *  - 'use client' 제거
 *  - WhatifSheet 는 미니앱 vaul Drawer 포트를 사용한다.
 */

import { useEffect, useState } from 'react';
import { ChevronRight, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { WhatifSheet } from '@/components/whatif/whatif-sheet';
import {
  markPaidFeatureClickedToday,
  shouldShowPaidFeatureAttention,
} from '@/lib/paid-feature-attention';

export function WhatifTrigger() {
  const t = useTranslations('whatif');
  const [open, setOpen] = useState(false);
  const [showDot, setShowDot] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowDot(shouldShowPaidFeatureAttention('whatif'));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function handleClick() {
    markPaidFeatureClickedToday('whatif');
    setShowDot(false);
    setOpen(true);
  }

  return (
    <section style={{ padding: '0 16px' }}>
      <button
        type="button"
        aria-label={String(t('sheet.trigger'))}
        className="btn-cta"
        onClick={handleClick}
        style={{
          position: 'relative',
          width: '100%',
          overflow: 'hidden',
          backgroundColor: 'var(--bg-card)',
          color: 'var(--text-primary)',
          borderRadius: 'var(--r-xl)',
          padding: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          border: '1px solid color-mix(in srgb, var(--primary) 22%, transparent)',
          cursor: 'pointer',
          textAlign: 'left',
          boxShadow: 'var(--e-1)',
        }}
      >
        <span
          aria-hidden
          style={{
            position: 'absolute',
            inset: '0 0 0 auto',
            width: 96,
            background: 'linear-gradient(270deg, color-mix(in srgb, var(--primary) 20%, transparent), transparent)',
          }}
        />
        {showDot && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: '#ef4444',
              boxShadow: '0 0 0 3px rgba(239,68,68,0.18)',
            }}
          />
        )}
        <span
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            width: '100%',
          }}
        >
          <span
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'var(--primary)',
              color: 'var(--primary-foreground)',
              flexShrink: 0,
            }}
          >
            <Sparkles size={20} />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', color: 'var(--primary)' }}>
              {t('sheet.eyebrow')}
            </span>
            <span style={{ display: 'block', marginTop: 2, fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              {t('sheet.trigger')}
            </span>
            <span style={{ display: 'block', marginTop: 4, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              {t('sheet.spotlight')}
            </span>
          </span>
          <ChevronRight size={20} style={{ flexShrink: 0, color: 'var(--primary)' }} />
        </span>
      </button>
      <WhatifSheet open={open} onOpenChange={setOpen} />
    </section>
  );
}
