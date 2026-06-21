/**
 * me-hero.tsx — 본명식(내 프로필) Dawn 워터컬러 히어로 (미니앱 포트)
 *
 * UIDesign 원본: UIDesign/SAJU-handoff/src/components/me/me-hero-dawn.tsx
 * 미니앱 변환: Tailwind → 인라인 스타일, --el-* → --accent-*, 한↔영 오행 키 불일치 해소
 *   (레퍼런스 tone 맵은 영문 키라 한글 day_master_element 에 항상 wood 폴백되던 버그 → 한글 키 맵).
 *   ADR-038: convertHanja() 경유 한자 미노출. 닉네임/생일은 사용자 자신 데이터 표시(§5 LLM 미포함).
 *
 * 구조: 220px+ 풀블리드 워터컬러 배경 위에 상단 블록(아이브로우+일주 타이틀+닉네임·생일+편집)
 *   + 하단 떠있는 프로스티드 일주 글래스 카드(글리프 타일 + 일주명 + 일간 성향 문장).
 */

import { useTranslations } from 'next-intl';
import { Pencil } from 'lucide-react';

import { DawnHeroBg } from '@/components/decoration/dawn-hero-bg';
import { pillarDescriptor } from '@/lib/saju/pillarDescriptor';
import { elementLabel, type OhaengElement } from '@/lib/saju/elementLabel';
import { convertHanja } from '@/lib/glossary/post-process';
import type { ChartCore } from '@/types/chart';

interface MeHeroProps {
  chart: ChartCore;
  nickname?: string;
  birthDateLabel?: string;
  onEdit: () => void;
}

// 일주 한자(日柱) — 타일·이름 title 툴팁용(표시 텍스트는 convertHanja 한글)
const { hanja: DAY_HANJA } = pillarDescriptor('일');

// 오행(한글 키) → Dawn tone: soft 틴트 배경 + base 색. (레퍼런스 영문 키 버그 회피)
const ELEMENT_TONE: Record<OhaengElement, { bg: string; fg: string }> = {
  목: { bg: 'var(--accent-wood-soft)', fg: 'var(--accent-wood)' },
  화: { bg: 'var(--accent-fire-soft)', fg: 'var(--accent-fire)' },
  토: { bg: 'var(--accent-earth-soft)', fg: 'var(--accent-earth)' },
  금: { bg: 'var(--accent-metal-soft)', fg: 'var(--accent-metal)' },
  수: { bg: 'var(--accent-water-soft)', fg: 'var(--accent-water)' },
};

export function MeHero({ chart, nickname, birthDateLabel, onEdit }: MeHeroProps) {
  const t = useTranslations('me');

  const element = chart.day_master_element;
  const elementKnown = element in ELEMENT_TONE;
  const tone = ELEMENT_TONE[element] ?? ELEMENT_TONE['목'];
  const elHanja = elementKnown ? elementLabel(element).hanja : undefined;

  const reading = convertHanja(chart.day_pillar ?? '甲子');
  const subtitle = [nickname, birthDateLabel].filter(Boolean).join(' · ');

  return (
    <header
      data-testid="me-hero"
      style={{
        position: 'relative',
        minHeight: 220,
        margin: '0 -16px', // 페이지 좌우 패딩(16px) 상쇄 → 풀블리드
        overflow: 'hidden',
        borderRadius: 'var(--r-xl)',
      }}
    >
      <DawnHeroBg animated />
      <div
        style={{
          position: 'relative',
          minHeight: 220,
          padding: '14px 20px 16px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        {/* 상단: 아이브로우 + 일주 타이틀 + 닉네임·생일 + 편집 */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--text-tertiary)',
              }}
            >
              {t('title')}
            </p>
            <p
              data-testid="me-hero-title"
              style={{
                margin: '4px 0 0',
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 22,
                lineHeight: 1.25,
                letterSpacing: '-0.02em',
                color: 'var(--text-primary)',
              }}
            >
              {reading}
            </p>
            {subtitle && (
              <p
                style={{
                  margin: '6px 0 0',
                  fontSize: 11.5,
                  fontWeight: 500,
                  lineHeight: 1,
                  color: 'var(--text-secondary)',
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onEdit}
            aria-label={t('hero.edit.trigger')}
            style={{
              flexShrink: 0,
              width: 38,
              height: 38,
              padding: 0,
              borderRadius: 12,
              background: 'var(--dawn-card-bg)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: '1px solid var(--dawn-card-border)',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <Pencil size={18} aria-hidden />
          </button>
        </div>

        {/* 하단: 떠있는 프로스티드 일주 글래스 카드 */}
        <div
          className="anim-dawn-breathe"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '12px 16px',
            borderRadius: 18,
            background: 'var(--dawn-card-bg)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid var(--dawn-card-border)',
            boxShadow: '0 8px 28px rgba(20, 18, 24, 0.08)',
          }}
        >
          <div
            data-testid="me-hero-tile"
            title={DAY_HANJA}
            style={{
              flexShrink: 0,
              width: 56,
              height: 56,
              borderRadius: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 26,
              letterSpacing: '-0.02em',
              background: tone.bg,
              color: tone.fg,
            }}
          >
            {reading}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 11,
                letterSpacing: '0.04em',
                color: tone.fg,
              }}
            >
              ILJU · {t('hero.eyebrow')}
            </p>
            <p
              title={DAY_HANJA}
              style={{
                margin: '4px 0 0',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 14,
                lineHeight: 1.3,
                color: 'var(--text-primary)',
              }}
            >
              {reading} 일주
            </p>
            {elementKnown && (
              <p
                title={elHanja}
                style={{
                  margin: '2px 0 0',
                  fontSize: 11,
                  fontWeight: 500,
                  lineHeight: 1.3,
                  color: 'var(--text-tertiary)',
                }}
              >
                {t(`section.daymaster.${element}` as Parameters<typeof t>[0])}
              </p>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
