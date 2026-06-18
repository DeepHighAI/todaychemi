/**
 * legal-consent-block.tsx — 필수 동의 블록 (미니앱)
 *
 * 웹앱 원본: src/components/legal/legal-consent-block.tsx (Tailwind → 인라인 스타일).
 * 약관·개인정보·연령 3개 필수 동의 체크박스. 약관/개인정보 행은 문서명을 "보기" 링크로
 * 노출하며, 클릭 시 onViewDocument(slug) 로 상위(Step4Review)가 바텀시트를 연다.
 *
 * controlled — value/onChange 로 상태를 상위에서 관리.
 */

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';

export interface LegalConsentValue {
  terms: boolean;
  privacy: boolean;
  age: boolean;
}

export type LegalDocSlug = 'terms' | 'privacy';

interface LegalConsentBlockProps {
  value: LegalConsentValue;
  onChange: (next: LegalConsentValue) => void;
  disabled?: boolean;
  onViewDocument: (slug: LegalDocSlug) => void;
}

export function LegalConsentBlock({
  value,
  onChange,
  disabled = false,
  onViewDocument,
}: LegalConsentBlockProps) {
  const t = useTranslations('onboarding');

  function update(key: keyof LegalConsentValue, checked: boolean) {
    onChange({ ...value, [key]: checked });
  }

  const agreeSuffix = t('consent.agreeSuffix');

  return (
    <fieldset
      disabled={disabled}
      style={{
        margin: 0,
        padding: 12,
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)',
        backgroundColor: 'var(--surface-1)',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <legend style={{ padding: '0 4px', fontSize: 12, fontWeight: 700, color: 'var(--foreground)' }}>
        {t('consent.title')}
      </legend>

      <ConsentRow
        ariaLabel={`${t('consent.termsLabel')}${agreeSuffix}`}
        checked={value.terms}
        onChange={(checked) => update('terms', checked)}
      >
        <DocTrigger onClick={() => onViewDocument('terms')}>{t('consent.termsLabel')}</DocTrigger>
        {agreeSuffix}
      </ConsentRow>

      <ConsentRow
        ariaLabel={`${t('consent.privacyLabel')}${agreeSuffix}`}
        checked={value.privacy}
        onChange={(checked) => update('privacy', checked)}
      >
        <DocTrigger onClick={() => onViewDocument('privacy')}>{t('consent.privacyLabel')}</DocTrigger>
        {agreeSuffix}
      </ConsentRow>

      <ConsentRow
        ariaLabel={t('consent.age')}
        checked={value.age}
        onChange={(checked) => update('age', checked)}
      >
        {t('consent.age')}
      </ConsentRow>
    </fieldset>
  );
}

function ConsentRow({
  ariaLabel,
  checked,
  onChange,
  children,
}: {
  ariaLabel: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  const t = useTranslations('onboarding');
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minHeight: 44,
        fontSize: 12,
        color: 'var(--foreground)',
      }}
    >
      <input
        type="checkbox"
        aria-label={ariaLabel}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 16, height: 16, flexShrink: 0, accentColor: 'var(--primary)' }}
      />
      <span>
        {children}
        <span style={{ marginLeft: 4, color: 'var(--muted-foreground)' }}>{t('consent.required')}</span>
      </span>
    </label>
  );
}

function DocTrigger({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
      style={{
        padding: 0,
        border: 'none',
        background: 'none',
        font: 'inherit',
        fontWeight: 600,
        color: 'var(--primary)',
        textDecoration: 'underline',
        textUnderlineOffset: 4,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}
