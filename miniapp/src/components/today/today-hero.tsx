/**
 * today-hero.tsx — Liquid Glass 히어로 (미니앱 포트)
 *
 * 웹앱 원본: src/components/today/today-hero.tsx
 * 변경 사항:
 *  - 'use client' 제거
 *  - next/link <Link href> → react-router <Link to>
 *  - @/ 절대 경로 → 상대 경로
 *  - AiDisclosureBadge: 공유 컴포넌트에서 import
 *  - 배경/글로스: .liquid 클래스로 통일(인라인 그라데이션·수동 글로스 span 제거)
 *
 * G-10 ADR-032 Amend: 인연 0건 hero 유도 블록 유지.
 */

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import { convertHanja } from '../../lib/glossary/post-process';
import { formatTemperatureDelta, scoreToTemperature } from '../../lib/scoring/temperature';
import { AiDisclosureBadge } from '../ai-disclosure/ai-disclosure-badge';
import type { DailyHapCard } from '../../types/dailyHap';

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
  const isFallback = card.is_fallback === true;
  const effectiveScore = isFallback ? null : card.today_compat_score ?? score ?? null;
  const hasScore = typeof effectiveScore === 'number';
  const temperature = hasScore ? scoreToTemperature(effectiveScore) : null;
  const hasRelation = Boolean(card.relation_id && card.relation_nickname);

  return (
    <div
      className="liquid"
      style={{
        margin: '0 16px',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
      aria-label={t('greeting')}
    >
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          {/* 레이블 + AI 배지 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
              {t('greeting')}
            </p>
            <AiDisclosureBadge tone="dark" />
          </div>

          {/* 인연 chip — chipNode(RelationChip) 우선, 없으면 정적 텍스트 */}
          {hasRelation && chipNode && (
            <div style={{ position: 'relative', zIndex: 2 }}>{chipNode}</div>
          )}
          {hasRelation && !chipNode && (
            <p style={{
              marginTop: 6,
              display: 'inline-flex',
              alignItems: 'center',
              background: 'rgba(255,255,255,0.2)',
              color: 'white',
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 'var(--r-pill)',
              padding: '4px 10px',
              whiteSpace: 'nowrap',
            }}>
              {t('with_relation.chip_prefix')} {card.relation_nickname}
              {t('with_relation.chip_suffix')}
            </p>
          )}

          {/* 온도 / 헤드라인 — /feed 이동 */}
          <Link to="/feed" style={{ display: 'block', textDecoration: 'none' }}>
            {hasScore ? (
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 56, lineHeight: 1, letterSpacing: '-0.045em', color: 'white', marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
                {temperature?.toFixed(1)}
                <span style={{ fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.85)', marginLeft: 4, letterSpacing: 'normal', verticalAlign: 'baseline' }}>°C</span>
              </p>
            ) : (
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, lineHeight: 1.18, letterSpacing: '-0.025em', color: 'white', marginTop: 8, whiteSpace: 'pre-line' }}>
                {convertHanja(card.headline)}
              </p>
            )}

            {!isFallback && typeof card.today_compat_score === 'number' && (
              <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>
                {t('with_relation.compat_label')}
              </p>
            )}
          </Link>
        </div>

        {typeof deltaVsYesterday === 'number' && deltaVsYesterday !== 0 && (
          <span style={{
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            background: 'rgba(255,255,255,0.2)',
            color: 'white',
            fontSize: 11,
            fontWeight: 700,
            lineHeight: 1.3,
            borderRadius: 'var(--r-pill)',
            padding: '4px 10px',
            whiteSpace: 'nowrap',
          }}>
            {deltaVsYesterday > 0 ? '▲' : '▼'} {formatTemperatureDelta(deltaVsYesterday)} vs {t('yesterday')}
          </span>
        )}
      </div>

      {/* 헤드라인 이유 — /feed 이동 */}
      <Link
        to="/feed"
        style={{ position: 'relative', zIndex: 1, display: 'block', fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 1.45, textDecoration: 'none' }}
      >
        {convertHanja(card.headline_reason)}
      </Link>

      {card.reused_from_yesterday && (
        <span style={{ position: 'relative', zIndex: 1, display: 'inline-block', background: 'rgba(255,255,255,0.2)', color: 'white', fontSize: 12, fontWeight: 500, borderRadius: 'var(--r-pill)', padding: '4px 12px' }}>
          {t('reused_label')}
        </span>
      )}

      {isFallback && (
        <span style={{ position: 'relative', zIndex: 1, display: 'inline-block', background: 'rgba(255,255,255,0.2)', color: 'white', fontSize: 12, fontWeight: 500, borderRadius: 'var(--r-pill)', padding: '4px 12px' }}>
          {t('fallback_label')}
        </span>
      )}

      {/* G-10 인연 0건 유도 블록 (ADR-032 Amend) */}
      {!hasRelation && (
        <div style={{ position: 'relative', zIndex: 1, background: 'rgba(255,255,255,0.15)', borderRadius: 'var(--r-md)', padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'white', lineHeight: 1.35, margin: 0 }}>
            {t('empty_relation.title')}
          </p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 1.45, margin: 0 }}>
            {t('empty_relation.subtitle')}
          </p>
          <Link
            to="/relations/new"
            style={{
              marginTop: 4,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 36,
              padding: '0 16px',
              borderRadius: 'var(--r-pill)',
              backgroundColor: 'var(--primary)',
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--primary-foreground)',
              textDecoration: 'none',
              flexShrink: 0,
              alignSelf: 'flex-start',
            }}
          >
            {t('empty_relation.cta')}
          </Link>
        </div>
      )}
    </div>
  );
}
