'use client';

import { Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';

type Tone = 'light' | 'dark';

interface AiDisclosureBadgeProps {
  /** 'dark' = liquid hero(어두운 배경, 흰 글씨) / 'light'(기본) = 밝은 카드 표면 */
  tone?: Tone;
  className?: string;
}

// 두 표면(밝은 카드 / 어두운 liquid hero) 모두에서 가독성을 확보하기 위한 톤 분기
const TONE_CLASS: Record<Tone, string> = {
  light: 'bg-secondary text-secondary-foreground',
  dark: 'bg-white/20 text-white',
};

// 생성형 결과(케미카드·오늘 케미·또 다른 나·케미 다시 맞추기)가 AI 생성물임을 알리는 배지 (ADR-038/1G)
export function AiDisclosureBadge({ tone = 'light', className = '' }: AiDisclosureBadgeProps) {
  const t = useTranslations('aiDisclosure');
  return (
    <span
      data-testid="ai-disclosure-badge"
      className={`inline-flex shrink-0 items-center gap-1 rounded-[var(--r-pill)] px-2 py-0.5 text-[11px] font-bold leading-[1.3] whitespace-nowrap ${TONE_CLASS[tone]} ${className}`}
    >
      <Sparkles aria-hidden className="size-3" />
      {t('badge')}
    </span>
  );
}
