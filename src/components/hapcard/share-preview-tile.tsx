'use client';

import { useTranslations } from 'next-intl';
import { buildOgPayload } from '@/lib/og/render-payload';
import type { SharePayloadInput, ShareRange } from '@/lib/share/build-share-payload';

const OHAENG_ORDER = ['목', '화', '토', '금', '수'] as const;

function todayKstString(): string {
  const fmt = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  // ko-KR 출력 "2026. 05. 10." → "2026.05.10"
  return fmt.format(new Date()).replaceAll(' ', '').replace(/\.$/, '');
}

interface Props {
  hapcard: SharePayloadInput;
  range: ShareRange;
}

export function HapcardSharePreviewTile({ hapcard, range }: Props) {
  const t = useTranslations('hapcard');
  const payload = buildOgPayload(
    {
      nickname: hapcard.nickname,
      score: hapcard.score,
      mode: hapcard.mode,
      ohaeng_counts: hapcard.ohaeng_counts,
      gender_normalized: hapcard.gender_normalized,
    },
    range,
  );

  return (
    <div className="px-4 pb-2">
      <div
        aria-label={t('sharePreview.ariaLabel')}
        className="aspect-square w-full rounded-[var(--radius-xl)] p-6 flex flex-col justify-between text-white shadow-md"
        style={{ backgroundImage: 'var(--background-image-liquid-dawn)' }}
      >
        {/* 상단: 아이브로 + 제목 */}
        <div>
          <div className="text-xs font-semibold opacity-85 tracking-wide">
            합플 · {payload.mode}
          </div>
          <div className="mt-1.5 text-[22px] font-extrabold leading-tight">
            나 ↔ {payload.nickname}
          </div>
        </div>

        {/* 중앙: 88px 점수 + 조건부 오행/성별 */}
        <div className="text-center">
          <div className="font-extrabold leading-none tracking-[-0.05em] text-[88px]">
            {payload.score}
            <span className="ml-1 text-[22px] font-bold opacity-85">점</span>
          </div>
          {range === 'nickname-ohaeng' && payload.ohaeng_counts && (
            <div className="mt-2 flex justify-center gap-2 text-sm font-semibold opacity-90">
              {OHAENG_ORDER.map((k) => (
                <span key={k}>
                  {k}
                  {payload.ohaeng_counts?.[k] ?? 0}
                </span>
              ))}
            </div>
          )}
          {range === 'nickname-gender' && payload.gender_normalized && (
            <div className="mt-2 text-sm font-semibold opacity-90">
              {payload.gender_normalized === 'F' ? '여성' : '남성'}
            </div>
          )}
        </div>

        {/* 하단: 날짜 + happle.app 핀 */}
        <div className="flex items-end justify-between">
          <div className="text-sm opacity-90">{todayKstString()}</div>
          <div className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-bold">
            happle.app
          </div>
        </div>
      </div>
    </div>
  );
}
