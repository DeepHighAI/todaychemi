import { formatTodayTemperature } from '@/lib/scoring/temperature';

export type ShareRange = 'nickname-only' | 'nickname-ohaeng' | 'nickname-gender';

export interface SharePayloadInput {
  hapcard_id: string;
  mode: string;
  nickname: string;
  score: number;
  gender_normalized: 'F' | 'M';
  ohaeng_counts: Record<string, number>;
  origin: string;
}

export interface SharePayload {
  title: string;
  text: string;
  url: string;
}

const OHAENG_ORDER = ['목', '화', '토', '금', '수'];
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

function genderLabel(gender: 'F' | 'M'): string {
  return gender === 'F' ? '여성' : '남성';
}

function ohaengSummary(counts: Record<string, number>): string {
  return OHAENG_ORDER.map((k) => `${k}${counts[k] ?? 0}`).join(' ');
}

export function buildSharePayload(input: SharePayloadInput & { range: ShareRange }): SharePayload {
  const { hapcard_id, mode, nickname, score, range, gender_normalized, ohaeng_counts, origin } = input;
  const nick = truncateNickname(nickname);
  const url = `${origin}/h/${hapcard_id}?mode=${mode}&range=${range}`;
  const modeLabel = MODE_LABELS[mode] ?? mode;
  const title = `${nick}님과의 ${modeLabel}`;

  let extra = '';
  if (range === 'nickname-ohaeng') {
    extra = ` · 오행: ${ohaengSummary(ohaeng_counts)}`;
  } else if (range === 'nickname-gender') {
    extra = ` · ${genderLabel(gender_normalized)}`;
  }

  const text = `${nick}님과의 오늘온도: ${formatTodayTemperature(score)}${extra} · 오늘사이에서 확인해봐`;

  return { title, text, url };
}
