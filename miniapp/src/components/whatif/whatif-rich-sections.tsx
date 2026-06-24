import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { convertHanja } from '@/lib/glossary/post-process';
import type {
  WhatifSajuBasis,
  WhatifSituationReading,
  WhatifTodayContext,
} from '@/types/diagnostic';

function Card({ testid, title, children }: { testid: string; title: string; children: ReactNode }) {
  return (
    <section
      data-testid={testid}
      style={{
        borderRadius: 18,
        backgroundColor: 'var(--bg-card)',
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <p style={{ font: 'var(--t-h3)', color: 'var(--text-primary)', margin: 0 }}>{title}</p>
      {children}
    </section>
  );
}

function ChipList({ items }: { items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {items.map((item, index) => (
        <span
          key={`${item}-${index}`}
          style={{
            borderRadius: 100,
            backgroundColor: 'color-mix(in srgb, var(--primary) 10%, transparent)',
            color: 'var(--primary)',
            padding: '5px 10px',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {convertHanja(item)}
        </span>
      ))}
    </div>
  );
}

function BulletList({ items }: { items: readonly string[] }) {
  return (
    <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 0, margin: 0, listStyle: 'none' }}>
      {items.map((item, index) => (
        <li key={`${item}-${index}`} style={{ font: 'var(--t-body)', color: 'var(--text-primary)', margin: 0 }}>
          {convertHanja(item)}
        </li>
      ))}
    </ul>
  );
}

export function WhatifTodayContextCard({
  context,
  targetDate,
}: {
  context?: WhatifTodayContext;
  targetDate: string;
}) {
  const t = useTranslations('whatif.result.section');
  if (!context) return null;
  return (
    <Card testid="whatif-today-context" title={String(t('today_context'))}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{ font: 'var(--t-h2)', color: 'var(--text-primary)', margin: 0 }}>
          {convertHanja(context.title)}
        </p>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', margin: 0 }}>
          {targetDate.replaceAll('-', '.')}
        </p>
        <p style={{ font: 'var(--t-body)', color: 'var(--text-primary)', margin: 0 }}>
          {convertHanja(context.summary)}
        </p>
        <p
          style={{
            borderRadius: 12,
            backgroundColor: 'var(--surface-1)',
            color: 'var(--text-secondary)',
            padding: '10px 12px',
            fontSize: 12,
            fontWeight: 700,
            lineHeight: 1.55,
            margin: 0,
          }}
        >
          {convertHanja(context.day_signal)}
        </p>
      </div>
    </Card>
  );
}

export function WhatifSajuBasisCard({ basis }: { basis?: WhatifSajuBasis }) {
  const t = useTranslations('whatif.result.section');
  if (!basis) return null;
  return (
    <Card testid="whatif-saju-basis" title={String(t('saju_basis'))}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ borderRadius: 12, backgroundColor: 'var(--surface-1)', padding: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', margin: 0 }}>{t('day_master')}</p>
          <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0 0' }}>
            {convertHanja(basis.day_master)}
          </p>
        </div>
        <div style={{ borderRadius: 12, backgroundColor: 'var(--surface-1)', padding: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', margin: 0 }}>{t('sinkang')}</p>
          <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0 0' }}>
            {basis.sinkang ?? t('unknown')}
          </p>
        </div>
      </div>
      <ChipList items={[...basis.dominant_sipsin, ...basis.missing_sipsin, ...basis.yongsin_candidates]} />
      <BulletList items={basis.notes} />
    </Card>
  );
}

export function WhatifSituationReadingCard({ reading }: { reading?: WhatifSituationReading }) {
  const t = useTranslations('whatif.result.section');
  if (!reading) return null;
  return (
    <Card testid="whatif-situation-reading" title={String(t('situation_reading'))}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ borderRadius: 12, backgroundColor: 'color-mix(in srgb, var(--primary) 10%, transparent)', padding: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--primary)', margin: '0 0 8px' }}>{t('strength')}</p>
          <BulletList items={reading.strength} />
        </div>
        <div style={{ borderRadius: 12, backgroundColor: 'color-mix(in srgb, var(--warn) 12%, transparent)', padding: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--warn)', margin: '0 0 8px' }}>{t('caution')}</p>
          <BulletList items={reading.caution} />
        </div>
      </div>
    </Card>
  );
}

export function WhatifAvoidTodayCard({ items }: { items?: readonly string[] }) {
  const t = useTranslations('whatif.result.section');
  if (!items || items.length === 0) return null;
  return (
    <Card testid="whatif-avoid-today" title={String(t('avoid_today'))}>
      <BulletList items={items} />
    </Card>
  );
}
