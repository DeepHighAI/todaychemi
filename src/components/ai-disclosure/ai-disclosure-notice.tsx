'use client';

import { useTranslations } from 'next-intl';

import { AiDisclosureBadge } from './ai-disclosure-badge';

interface AiDisclosureNoticeProps {
  className?: string;
}

// 온보딩 최초 1회 AI 생성 고지 — 결과 화면의 배지와 짝을 이루는 본문 안내 (1G)
export function AiDisclosureNotice({ className = '' }: AiDisclosureNoticeProps) {
  const t = useTranslations('aiDisclosure');
  return (
    <section
      data-testid="ai-disclosure-notice"
      className={`rounded-[var(--r-md)] bg-muted p-4 space-y-2 ${className}`}
    >
      <div className="flex items-center gap-2">
        <AiDisclosureBadge tone="light" />
        <h2 className="text-[13px] font-bold text-foreground">{t('notice.title')}</h2>
      </div>
      <p className="text-[12px] leading-5 text-muted-foreground">{t('notice.body')}</p>
    </section>
  );
}
