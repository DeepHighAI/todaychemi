import type { ShareRange } from '@/lib/share/build-share-payload';
import { formatTodayTemperature } from '@/lib/scoring/temperature';
import { formatShareModeLabel, truncateShareNickname } from '@/lib/share/display-format';

export interface OgPayloadInput {
  nickname: string;
  score: number;
  mode: string;
  ohaeng_counts?: Record<string, number>;
  gender_normalized?: 'F' | 'M';
}

export interface OgPayload {
  nickname: string;
  score: number;
  temperature_label: string;
  mode: string;
  range: ShareRange;
  ohaeng_counts?: Record<string, number>;
  gender_normalized?: 'F' | 'M';
}

export function buildOgPayload(input: OgPayloadInput, range: ShareRange): OgPayload {
  const base: OgPayload = {
    nickname: truncateShareNickname(input.nickname),
    score: input.score,
    temperature_label: formatTodayTemperature(input.score),
    mode: formatShareModeLabel(input.mode),
    range,
  };

  if (range === 'nickname-ohaeng') {
    base.ohaeng_counts = input.ohaeng_counts;
  } else if (range === 'nickname-gender') {
    base.gender_normalized = input.gender_normalized;
  }

  return base;
}
