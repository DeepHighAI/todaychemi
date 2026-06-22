/**
 * reward-notice.tsx — 부적 지급 비모달 안내.
 *
 * 가입(+50) / 매일 출석(+5) 보상 수령 시 화면을 막지 않는 상태 알림으로 안내한다.
 * 앱 진입 직후 자동 Dialog/Sheet 를 띄우지 않기 위한 앱인토스 UX 가이드 대응이다.
 */

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface RewardNoticeProps {
  /** 이번에 획득한 부적 총 개수 */
  amount: number;
  /** 가입 보상 포함 여부 (true=환영 카피, false=출석 카피) */
  isSignup: boolean;
  onClose: () => void;
}

export function RewardNotice({ amount, isSignup, onClose }: RewardNoticeProps) {
  const t = useTranslations('rewards.notice');

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        left: 16,
        right: 16,
        bottom: 'calc(var(--tabbar-h) + env(safe-area-inset-bottom) + 8px)',
        zIndex: 35,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: 'min(100%, 360px)',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          borderRadius: 'var(--r-lg)',
          border: '1px solid var(--hairline)',
          backgroundColor: 'var(--bg-card)',
          boxShadow: 'var(--e-3)',
          padding: '12px 12px 12px 14px',
          pointerEvents: 'auto',
        }}
      >
        <div
          aria-hidden
          style={{
            width: 42,
            height: 42,
            borderRadius: 'var(--r-pill)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            backgroundColor: 'var(--p-90)',
            color: 'var(--p-10)',
            fontSize: 13,
            fontWeight: 800,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          +{amount}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
            {isSignup ? t('title.signup') : t('title.daily')}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 12, lineHeight: 1.45, color: 'var(--text-secondary)' }}>
            {t('usage')}
          </p>
        </div>
        <button
          type="button"
          aria-label={t('close')}
          onClick={onClose}
          style={{
            width: 36,
            height: 36,
            borderRadius: 'var(--r-pill)',
            border: 'none',
            backgroundColor: 'transparent',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
