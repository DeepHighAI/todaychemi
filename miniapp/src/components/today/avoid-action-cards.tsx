/**
 * avoid-action-cards.tsx — 오늘 피할 말 + 오늘 좋은 행동 카드 (미니앱 포트)
 *
 * 웹앱 원본: src/components/today/avoid-action-cards.tsx
 * 변경 사항:
 *  - 'use client' 제거
 *  - @/ 경로 → 상대 경로
 */

import { useTranslations } from 'next-intl';
import { convertHanja } from '../../lib/glossary/post-process';
import type { DailyHapCard } from '../../types/dailyHap';

interface AvoidActionCardsProps {
  card: DailyHapCard;
}

export function AvoidActionCards({ card }: AvoidActionCardsProps) {
  const t = useTranslations('home');
  const avoidPhrase = card.avoid_phrase.trim() || t('fallback.avoid_phrase');
  const avoidReason = card.avoid_phrase_reason.trim() || t('fallback.avoid_phrase_reason');
  const favorableAction = card.favorable_action.trim() || t('fallback.favorable_action');
  const favorableReason = card.favorable_action_reason.trim() || t('fallback.favorable_action_reason');

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'var(--surface-2)',
    borderRadius: 'var(--r-lg)',
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 16px' }}>
      <div data-card="avoid" style={cardStyle}>
        <p style={{ font: 'var(--t-cap)', color: 'var(--text-secondary)', margin: 0 }}>
          {t('avoid_phrase_label')}
        </p>
        <p style={{ font: 'var(--t-h3)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          {convertHanja(avoidPhrase)}
        </p>
        <p style={{ font: 'var(--t-sub)', color: 'var(--text-secondary)', margin: 0 }}>
          {convertHanja(avoidReason)}
        </p>
      </div>
      <div data-card="favorable" style={cardStyle}>
        <p style={{ font: 'var(--t-cap)', color: 'var(--text-secondary)', margin: 0 }}>
          {t('favorable_action_label')}
        </p>
        <p style={{ font: 'var(--t-h3)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          {convertHanja(favorableAction)}
        </p>
        <p style={{ font: 'var(--t-sub)', color: 'var(--text-secondary)', margin: 0 }}>
          {convertHanja(favorableReason)}
        </p>
      </div>
    </div>
  );
}
