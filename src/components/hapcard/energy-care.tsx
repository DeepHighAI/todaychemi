'use client';

/* HapcardEnergyCare — 기운 음식(energy_food) + 만남 분위기(meeting_vibe) 표시 섹션.
 * ADR-016: additive 컴포넌트 7 (잠금된 1~6 위에 얹음).
 * ADR-015: 명리 근거(reason) 항상 표시. ADR-038: LLM 문자열 convertHanja() 안전망 필수.
 * §5: meeting_vibe 는 추상 분위기만(실제 장소 없음) — 첫합·썸합에서만 제공된다.
 */

import { useTranslations } from 'next-intl';

import { convertHanja } from '@/lib/glossary/post-process';
import type { EnergyFood, MeetingVibe } from '@/types/hapcard';

interface HapcardEnergyCareProps {
  energyFood?: EnergyFood;
  meetingVibe?: MeetingVibe;
}

export function HapcardEnergyCare({ energyFood, meetingVibe }: HapcardEnergyCareProps) {
  const t = useTranslations('hapcard.energyCare');

  if (!energyFood) {
    return (
      <div data-testid="hapcard-energy-care" className="rounded-2xl bg-card p-6">
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      </div>
    );
  }

  return (
    <div data-testid="hapcard-energy-care" className="rounded-2xl bg-card p-6 space-y-4">
      <section className="space-y-2">
        <p className="font-eyebrow text-primary">{t('food.title')}</p>
        <p className="font-body font-bold text-foreground">{convertHanja(energyFood.copy)}</p>
        <ul className="flex flex-wrap gap-2">
          {energyFood.foods.map((food, index) => (
            <li
              key={index}
              className="rounded-[var(--r-pill)] bg-[var(--surface-2)] px-3 py-1 font-sub text-foreground"
            >
              {convertHanja(food)}
            </li>
          ))}
        </ul>
        {/* ADR-015: 명리 근거 항상 표시 */}
        <p className="font-sub text-muted-foreground">{convertHanja(energyFood.reason)}</p>
      </section>

      {meetingVibe && (
        <section className="space-y-1 border-t border-border pt-4">
          <p className="font-eyebrow text-primary">{t('vibe.title')}</p>
          <p className="font-body font-bold text-foreground">{convertHanja(meetingVibe.archetype)}</p>
          <p className="font-sub text-muted-foreground">{convertHanja(meetingVibe.copy)}</p>
        </section>
      )}
    </div>
  );
}
