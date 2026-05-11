'use client';

import { useTranslations } from 'next-intl';
import { extractConclusion } from '@/lib/hapcard/extract-conclusion';
import { convertHanja } from '@/lib/glossary/post-process';

interface HapcardConclusionProps {
  mainText: string;
}

export function HapcardConclusion({ mainText }: HapcardConclusionProps) {
  const t = useTranslations('hapcard');
  // 먼저 첫 문장을 추출한 뒤 한자 변환 적용
  const conclusion = convertHanja(extractConclusion(mainText));
  return (
    <div data-testid="hapcard-conclusion" className="rounded-2xl bg-card p-6 space-y-1">
      <p
        data-testid="conclusion-eyebrow"
        className="font-eyebrow text-primary"
      >
        {t('conclusion.eyebrow')}
      </p>
      <h2 className="font-h2 text-foreground text-balance">
        {conclusion}
      </h2>
    </div>
  );
}
