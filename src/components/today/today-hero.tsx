'use client';

/* TodayHero — Liquid Glass hero with score signature
 * Canvas reference: type-d/screens-interactive.jsx::IHome (Liquid Glass hero section)
 *
 * G2 / Phase 3 C8: 인연 chip + 오늘 합온도 노출.
 * F2.2: outer Link 제거 — chip 위치는 인터랙티브 영역으로 분리.
 *   - hero 자체는 div (탭 영역 ≠ 단일 navigate)
 *   - body 텍스트 영역(temperature/headline_reason) 만 Link 로 /feed 이동
 *   - chip 자리는 chipNode 슬롯 (F2.3 에서 RelationChip 주입)
 *   - 인연 0건 CTA 는 자체 Link 로 /relations/new 이동
 */

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { convertHanja } from '@/lib/glossary/post-process';
import { formatTemperatureDelta, scoreToTemperature } from '@/lib/scoring/temperature';
import type { DailyHapCard } from '@/types/dailyHap';

interface TodayHeroProps {
  card: DailyHapCard;
  score?: number | null;
  deltaVsYesterday?: number | null;
  /** F2.3 에서 RelationChip 주입 — 미주입 시 정적 텍스트 chip 폴백 */
  chipNode?: ReactNode;
}

export function TodayHero({ card, score, deltaVsYesterday, chipNode }: TodayHeroProps) {
  const t = useTranslations('home');

  // G2: today_compat_score 가 합점수보다 우선 (매일 변동성이 본질)
  const effectiveScore = card.today_compat_score ?? score ?? null;
  const hasScore = typeof effectiveScore === 'number';
  const temperature = hasScore ? scoreToTemperature(effectiveScore) : null;
  const hasRelation = Boolean(card.relation_id && card.relation_nickname);

  return (
    <div
      className="bg-liquid-hero rounded-[var(--r-xl)] mx-4 p-5 space-y-3 relative overflow-hidden"
      aria-label={t('greeting')}
    >
      {/* gloss overlay (matches canvas .liquid::before) */}
      <span
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.30), transparent 50%)' }}
      />

      <div className="relative z-[1] flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-white/85 uppercase tracking-[0.08em]">
            {t('greeting')}
          </p>

          {/* F2.2/F2.3: chipNode (RelationChip) 우선, 없으면 정적 chip 폴백.
              chipNode 자체가 인터랙티브 button — Link 자손이 아니므로 chip 클릭은
              navigate 가 아닌 dropdown 트리거가 됨. */}
          {hasRelation && chipNode && <div className="relative z-[2]">{chipNode}</div>}
          {hasRelation && !chipNode && (
            <p className="mt-1.5 inline-flex items-center bg-white/20 text-white text-[12px] font-semibold rounded-full px-2.5 py-1 whitespace-nowrap">
              {t('with_relation.chip_prefix')} {card.relation_nickname}
              {t('with_relation.chip_suffix')}
            </p>
          )}

          {/* score + headline_reason 영역만 /feed 로 이동 (선택적 navigate) */}
          <Link href="/feed" className="block active:scale-[0.99] transition-transform">
            {hasScore ? (
              <p className="font-display font-black text-[56px] leading-none tracking-[-0.045em] text-white mt-1.5 tabular-nums">
                {temperature?.toFixed(1)}
                <span className="text-[18px] font-bold text-white/85 ml-1 tracking-normal align-baseline">°C</span>
              </p>
            ) : (
              <p className="font-display font-extrabold text-[28px] leading-[1.18] tracking-[-0.025em] text-white mt-2 whitespace-pre-line">
                {convertHanja(card.headline)}
              </p>
            )}

            {typeof card.today_compat_score === 'number' && (
              <p className="text-[11px] font-semibold text-white/75 mt-1">
                {t('with_relation.compat_label')}
              </p>
            )}
          </Link>
        </div>

        {typeof deltaVsYesterday === 'number' && deltaVsYesterday !== 0 && (
          <span className="shrink-0 inline-flex items-center bg-white/20 text-white text-[11px] font-bold leading-[1.3] rounded-full px-2.5 py-1 whitespace-nowrap">
            {deltaVsYesterday > 0 ? '▲' : '▼'} {formatTemperatureDelta(deltaVsYesterday)} vs {t('yesterday')}
          </span>
        )}
      </div>

      <Link href="/feed" className="relative z-[1] block text-sm text-white/85 leading-[1.45]">
        {convertHanja(card.headline_reason)}
      </Link>

      {card.reused_from_yesterday && (
        <span className="relative z-[1] inline-block bg-white/20 text-white text-xs font-medium rounded-full px-3 py-1">
          {t('reused_label')}
        </span>
      )}

      {/* G2: 인연 0건 사용자용 CTA — 자체 Link 로 /relations/new 이동 */}
      {!hasRelation && (
        <Link
          href="/relations/new"
          className="relative z-[1] inline-block text-[12px] font-bold text-white/95 underline underline-offset-2"
        >
          {t('empty_relation.cta')}
        </Link>
      )}
    </div>
  );
}
