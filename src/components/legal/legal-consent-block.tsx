'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';

import { LegalDocumentDialog } from '@/components/legal/legal-document-dialog';
import type { LegalConsentState } from '@/lib/legal/consent';
import type { LegalDocumentSlug } from '@/lib/legal/documents';

interface LegalConsentBlockProps {
  value: LegalConsentState;
  onChange: (next: LegalConsentState) => void;
  disabled?: boolean;
  title?: string;
}

type LegalConsentKey = keyof LegalConsentState;

export function LegalConsentBlock({
  value,
  onChange,
  disabled = false,
  title = '필수 동의',
}: LegalConsentBlockProps) {
  const [documentSlug, setDocumentSlug] = useState<LegalDocumentSlug | null>(null);

  function update(key: LegalConsentKey, checked: boolean) {
    onChange({ ...value, [key]: checked });
  }

  return (
    <>
      <fieldset
        className="rounded-[var(--r-md)] border border-border bg-[var(--surface-1)] p-3"
        disabled={disabled}
      >
        <legend className="px-1 text-xs font-bold text-foreground">{title}</legend>
        <div className="mt-2 space-y-1">
          <ConsentRow
            id="legal-consent-terms"
            ariaLabel="이용약관 동의"
            checked={value.terms}
            onChange={(checked) => update('terms', checked)}
          >
            <LegalDocumentTrigger slug="terms" onOpen={setDocumentSlug}>
              이용약관
            </LegalDocumentTrigger>
            에 동의합니다
          </ConsentRow>
          <ConsentRow
            id="legal-consent-privacy"
            ariaLabel="개인정보처리방침 동의"
            checked={value.privacy}
            onChange={(checked) => update('privacy', checked)}
          >
            <LegalDocumentTrigger slug="privacy" onOpen={setDocumentSlug}>
              개인정보처리방침
            </LegalDocumentTrigger>
            에 동의합니다
          </ConsentRow>
          <ConsentRow
            id="legal-consent-age"
            ariaLabel="만 14세 이상입니다"
            checked={value.age}
            onChange={(checked) => update('age', checked)}
          >
            만 14세 이상입니다
          </ConsentRow>
        </div>
      </fieldset>
      <LegalDocumentDialog
        slug={documentSlug}
        open={documentSlug !== null}
        onOpenChange={(open) => {
          if (!open) setDocumentSlug(null);
        }}
      />
    </>
  );
}

function LegalDocumentTrigger({
  slug,
  onOpen,
  children,
}: {
  slug: Extract<LegalDocumentSlug, 'terms' | 'privacy'>;
  onOpen: (slug: LegalDocumentSlug) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="font-semibold text-primary underline underline-offset-4"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onOpen(slug);
      }}
    >
      {children}
    </button>
  );
}

function ConsentRow({
  id,
  ariaLabel,
  checked,
  onChange,
  children,
}: {
  id: string;
  ariaLabel: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label htmlFor={id} className="flex min-h-11 items-center gap-2.5 text-xs text-foreground">
      <input
        id={id}
        aria-label={ariaLabel}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 shrink-0 accent-primary"
      />
      <span>
        {children}
        <span className="ml-1 text-muted-foreground">(필수)</span>
      </span>
    </label>
  );
}
