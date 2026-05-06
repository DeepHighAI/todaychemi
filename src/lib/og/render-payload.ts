import type { ShareRange } from '@/lib/share/build-share-payload';

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
  mode: string;
  range: ShareRange;
  ohaeng_counts?: Record<string, number>;
  gender_normalized?: 'F' | 'M';
}

function truncateNickname(nickname: string): string {
  if (nickname.length <= 30) return nickname;
  return nickname.slice(0, 30) + '…';
}

export function buildOgPayload(input: OgPayloadInput, range: ShareRange): OgPayload {
  const base: OgPayload = {
    nickname: truncateNickname(input.nickname),
    score: input.score,
    mode: input.mode,
    range,
  };

  if (range === 'nickname-ohaeng') {
    base.ohaeng_counts = input.ohaeng_counts;
  } else if (range === 'nickname-gender') {
    base.gender_normalized = input.gender_normalized;
  }

  return base;
}
