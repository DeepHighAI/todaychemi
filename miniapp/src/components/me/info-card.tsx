/**
 * info-card.tsx — 앱 설정·정보 링크 카드 (미니앱 포트)
 *
 * 웹앱 원본: src/components/me/info-card.tsx
 * 미니앱: Tailwind → 인라인 스타일. lucide-react 유지.
 * 언어 변경(onLang)·앱 정보(onAbout)는 미니앱에서 시트 없이 no-op 처리.
 */

import { ChevronRight, FileText, Globe2, Info, LogOut, Shield, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface InfoCardProps {
  onPrivacy: () => void;
  onTerms: () => void;
  onAbout: () => void;
  onLang: () => void;
  onDeleteAccount: () => void;
  onLogout: () => void;
  logoutLoading?: boolean;
}

export function InfoCard({
  onPrivacy,
  onTerms,
  onAbout,
  onLang,
  onDeleteAccount,
  onLogout,
  logoutLoading = false,
}: InfoCardProps) {
  const t = useTranslations('me.info');

  return (
    <section
      data-testid="info-card"
      style={{
        overflow: 'hidden',
        borderRadius: 'var(--r-md)',
        border: '1px solid var(--hairline)',
        backgroundColor: 'var(--bg-card)',
      }}
    >
      <div style={{ padding: '12px 16px 4px' }}>
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'var(--text-secondary)',
            margin: 0,
          }}
        >
          {t('eyebrow')}
        </p>
      </div>
      <InfoRow Icon={Globe2} label={t('language')} sub={t('languageSub')} onClick={onLang} />
      <InfoRow Icon={Shield} label={t('privacy')} sub={t('privacySub')} onClick={onPrivacy} />
      <InfoRow Icon={FileText} label={t('terms')} sub={t('termsSub')} onClick={onTerms} />
      <InfoRow Icon={Trash2} label={t('deleteAccount')} sub={t('deleteAccountSub')} onClick={onDeleteAccount} danger />
      <InfoRow Icon={Info} label={t('about')} sub={t('aboutSub')} onClick={onAbout} />
      <InfoRow
        Icon={LogOut}
        label={t('logout')}
        sub={logoutLoading ? t('logoutLoading') : t('logoutSub')}
        onClick={onLogout}
        danger
        disabled={logoutLoading}
      />
    </section>
  );
}

function InfoRow({
  Icon,
  label,
  sub,
  onClick,
  danger = false,
  disabled = false,
}: {
  Icon: React.ComponentType<{ size?: number }>;
  label: string;
  sub: string;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        width: '100%',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        backgroundColor: 'transparent',
        border: 'none',
        borderTop: '1px solid var(--hairline)',
        cursor: 'pointer',
        opacity: disabled ? 0.6 : 1,
        textAlign: 'left',
      } as React.CSSProperties}
    >
      <span
        style={{
          display: 'flex',
          width: 40,
          height: 40,
          flexShrink: 0,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 13,
          backgroundColor: 'var(--surface-2)',
          color: danger ? 'var(--destructive)' : 'var(--primary)',
        }}
      >
        <Icon size={19} />
      </span>
      <span style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
        <span
          style={{
            display: 'block',
            fontSize: 14,
            fontWeight: 700,
            color: danger ? 'var(--destructive)' : 'var(--text-primary)',
          }}
        >
          {label}
        </span>
        <span
          style={{
            marginTop: 2,
            display: 'block',
            fontSize: 12,
            color: 'var(--text-secondary)',
          }}
        >
          {sub}
        </span>
      </span>
      <ChevronRight size={18} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
    </button>
  );
}
