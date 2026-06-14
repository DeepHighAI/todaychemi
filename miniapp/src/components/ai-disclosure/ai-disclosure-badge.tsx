/**
 * ai-disclosure-badge.tsx — AI 생성 배지 (미니앱 포트, §6.4 법적 의무)
 *
 * 웹앱 원본: src/components/ai-disclosure/ai-disclosure-badge.tsx (next-intl + Tailwind)
 * 미니앱: next-intl useTranslations 유지 (App.tsx 의 NextIntlClientProvider 통해 제공됨).
 *         Tailwind → 인라인 스타일, 'use client' 제거.
 */

import { Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';

type Tone = 'light' | 'dark';

interface AiDisclosureBadgeProps {
  /** 'dark' = liquid hero(어두운 배경, 흰 글씨) / 'light'(기본) = 밝은 카드 표면 */
  tone?: Tone;
  className?: string;
}

// 두 표면(밝은 카드 / 어두운 liquid hero) 모두에서 가독성을 확보하기 위한 톤 분기
const TONE_STYLE: Record<Tone, React.CSSProperties> = {
  light: { backgroundColor: 'var(--secondary)', color: 'var(--secondary-foreground)' },
  dark:  { backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' },
};

// 생성형 결과(케미카드·오늘 케미·또 다른 나·케미 다시 맞추기)가 AI 생성물임을 알리는 배지 (ADR-038/1G)
export function AiDisclosureBadge({ tone = 'light', className = '' }: AiDisclosureBadgeProps) {
  const t = useTranslations('aiDisclosure');
  return (
    <span
      data-testid="ai-disclosure-badge"
      className={className}
      style={{
        display: 'inline-flex',
        flexShrink: 0,
        alignItems: 'center',
        gap: 4,
        borderRadius: 'var(--r-pill)',
        padding: '2px 8px',
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1.3,
        whiteSpace: 'nowrap',
        ...TONE_STYLE[tone],
      }}
    >
      <Sparkles aria-hidden style={{ width: 12, height: 12 }} />
      {t('badge')}
    </span>
  );
}
