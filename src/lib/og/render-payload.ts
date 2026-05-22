import type { ShareRange } from '@/lib/share/build-share-payload';
import { formatTodayTemperature } from '@/lib/scoring/temperature';

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

const MODE_LABELS: Record<string, string> = {
  일합: '일로 연결된 사이',
  친구합: '친구 사이',
  돈합: '돈이 오가는 사이',
  첫합: '처음 보는 사이',
  썸합: '끌리는 사이',
  오래합: '오래 알고 지낸 사이',
};

function truncateNickname(nickname: string): string {
  if (nickname.length <= 30) return nickname;
  return nickname.slice(0, 30) + '…';
}

export function buildOgPayload(input: OgPayloadInput, range: ShareRange): OgPayload {
  const base: OgPayload = {
    nickname: truncateNickname(input.nickname),
    score: input.score,
    temperature_label: formatTodayTemperature(input.score),
    mode: MODE_LABELS[input.mode] ?? input.mode,
    range,
  };

  if (range === 'nickname-ohaeng') {
    base.ohaeng_counts = input.ohaeng_counts;
  } else if (range === 'nickname-gender') {
    base.gender_normalized = input.gender_normalized;
  }

  return base;
}
