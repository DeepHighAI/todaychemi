/**
 * whatif-trigger.tsx — 또 다른 나(whatif) 진입 버튼 (미니앱 포트)
 *
 * 웹앱 원본: src/components/today/whatif-trigger.tsx
 * 변경 사항:
 *  - 'use client' 제거
 *  - WhatifSheet → react-router navigate('/whatif/...')로 대체
 *    (미니앱 whatif flow 는 별도 WhatifPage 라우트로 분리되어 있음)
 *  - @/ 경로 → react-router useNavigate
 *
 * NOTE: 웹앱은 바텀시트 직접 열기. 미니앱은 /whatif/:type 라우트로 이동.
 * WhatifSheet 전체 포팅(P5)까지는 이 방식 유지.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';

// 6모드 타입
type DiagnosticType =
  | 'work'
  | 'money'
  | 'love'
  | 'first_meet'
  | 'social'
  | 'self';

interface ModeOption {
  type: DiagnosticType;
  label: string;
}

const MODE_OPTIONS: ModeOption[] = [
  { type: 'work',       label: '직장·업무' },
  { type: 'money',      label: '재물·투자' },
  { type: 'love',       label: '연애·결혼' },
  { type: 'first_meet', label: '처음 보는 나' },
  { type: 'social',     label: '대인관계' },
  { type: 'self',       label: '나 자신' },
];

export function WhatifTrigger() {
  const t = useTranslations('whatif');
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  function handleSelect(type: DiagnosticType) {
    setOpen(false);
    navigate(`/whatif/${type}`);
  }

  return (
    <div style={{ padding: '0 16px' }}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          width: '100%',
          background: 'var(--primary)',
          color: 'white',
          borderRadius: 'var(--r-lg)',
          padding: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          border: 'none',
          cursor: 'pointer',
          font: 'var(--t-body)',
          fontWeight: 600,
        }}
      >
        <Sparkles size={20} />
        <span>{t('sheet.trigger')}</span>
      </button>

      {/* 모드 선택 바텀시트 — 바닐라 구현 (vaul) */}
      {open && (
        <>
          {/* 오버레이 */}
          <div
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 40,
              background: 'rgba(0,0,0,0.4)',
            }}
          />
          {/* 시트 */}
          <div style={{
            position: 'fixed',
            insetInline: 0,
            bottom: 0,
            zIndex: 50,
            backgroundColor: 'var(--background)',
            borderTopLeftRadius: 'var(--r-xl)',
            borderTopRightRadius: 'var(--r-xl)',
            padding: '20px 16px 32px',
          }}>
            <div style={{ margin: '0 auto 16px', width: 48, height: 6, borderRadius: 'var(--r-pill)', background: 'var(--surface-2)' }} />
            <p style={{ font: 'var(--t-h3)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 16 }}>
              {t('sheet.title')}
            </p>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 0, listStyle: 'none', margin: 0 }}>
              {MODE_OPTIONS.map((opt) => (
                <li key={opt.type}>
                  <button
                    type="button"
                    onClick={() => handleSelect(opt.type)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '14px 16px',
                      borderRadius: 'var(--r-md)',
                      background: 'var(--surface-2)',
                      border: 'none',
                      cursor: 'pointer',
                      font: 'var(--t-body)',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {opt.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
