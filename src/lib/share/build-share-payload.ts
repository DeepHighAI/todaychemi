import { formatTodayTemperature } from '@/lib/scoring/temperature';
import {
  formatShareGenderLabel,
  formatShareModeLabel,
  formatShareOhaengSummary,
  truncateShareNickname,
} from '@/lib/share/display-format';
import type { ShareRange } from '@/lib/share/schema';

export type { ShareRange } from '@/lib/share/schema';

export interface SharePayloadInput {
  hapcard_id: string;
  mode: string;
  nickname: string;
  score: number;
  gender_normalized: 'F' | 'M';
  ohaeng_counts: Record<string, number>;
  origin: string;
  public_url?: string;
  og_image_url?: string;
}

export interface SharePayload {
  title: string;
  text: string;
  url: string;
  og_image_url?: string;
}

export function buildSharePayload(input: SharePayloadInput & { range: ShareRange }): SharePayload {
  const {
    hapcard_id,
    mode,
    nickname,
    score,
    range,
    gender_normalized,
    ohaeng_counts,
    origin,
    public_url,
    og_image_url,
  } = input;
  const nick = truncateShareNickname(nickname);
  const url = public_url ?? `${origin}/h/${hapcard_id}?mode=${mode}&range=${range}`;
  const modeLabel = formatShareModeLabel(mode);
  const title = `${nick}님과의 ${modeLabel}`;

  let extra = '';
  if (range === 'nickname-ohaeng') {
    extra = ` · 오행: ${formatShareOhaengSummary(ohaeng_counts)}`;
  } else if (range === 'nickname-gender') {
    extra = ` · ${formatShareGenderLabel(gender_normalized)}`;
  }

  const text = `${nick}님과의 케미온도: ${formatTodayTemperature(score)}${extra} · 오늘케미에서 확인해봐`;

  return { title, text, url, og_image_url };
}

function trimTrailingSlash(origin: string): string {
  return origin.endsWith('/') ? origin.slice(0, -1) : origin;
}

export function buildPublicShareUrls(origin: string, token: string) {
  const base = trimTrailingSlash(origin);
  return {
    url: `${base}/h/${token}`,
    og_image_url: `${base}/api/og/share/${token}`,
  };
}
