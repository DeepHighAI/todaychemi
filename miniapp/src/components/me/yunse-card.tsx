/**
 * yunse-card.tsx — 대운·세운·월운·일운 운세 카드 (미니앱 포트)
 *
 * 웹앱 원본: src/components/me/yunse-card.tsx
 * 미니앱: Tailwind → 인라인 스타일.
 * ADR-038: convertHanja() 경유.
 */

import { useTranslations } from 'next-intl';
import { convertHanja } from '@/lib/glossary/post-process';
import type { YunseCore } from '@/types/chart';

type YunseCardProps = {
  yunse: YunseCore;
};

export default function YunseCard({ yunse }: YunseCardProps) {
  const t = useTranslations('me.section.yunse');

  return (
    <section
      data-testid="yunse-card"
      style={{
        borderRadius: 'var(--r-lg)',
        border: '1px solid var(--hairline)',
        backgroundColor: 'var(--bg-card)',
        boxShadow: 'var(--e-1)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
          {t('title')}
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
          {t('subtitle')}
        </p>
      </header>

      {/* 대운 가로 스크롤 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', margin: 0 }}>
          {t('daeun.label')}
        </p>
        <ul
          style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            paddingBottom: 4,
            margin: 0,
            paddingLeft: 0,
            listStyle: 'none',
          }}
        >
          {yunse.daeun.list.map((seg, idx) => {
            const isCurrent = idx === yunse.daeun.current_index;
            return (
              <li
                key={`${seg.age}-${seg.year}`}
                aria-current={isCurrent ? 'true' : undefined}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  minWidth: 56,
                  borderRadius: 'var(--r-md)',
                  border: `1px solid ${isCurrent ? 'var(--primary)' : 'var(--hairline)'}`,
                  padding: '8px 12px',
                  textAlign: 'center',
                  backgroundColor: isCurrent ? 'color-mix(in srgb, var(--primary) 10%, transparent)' : 'var(--bg-card)',
                  color: isCurrent ? 'var(--text-primary)' : 'var(--text-secondary)',
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: 10 }}>{seg.age}</span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{convertHanja(seg.pillar)}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* 세운·월운·일운 */}
      <dl style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <dt style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('seyun.label')}</dt>
          <dd style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            {convertHanja(yunse.seyun.current_pillar)}
          </dd>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <dt style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('wolun.label')}</dt>
          <dd style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            {convertHanja(yunse.wolun.current_pillar)}
          </dd>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <dt style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('iliun.label')}</dt>
          <dd style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            {convertHanja(yunse.iliun.today_pillar)}
          </dd>
        </div>
      </dl>

      <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
        {t('interpretationFooter')}
      </p>
    </section>
  );
}
