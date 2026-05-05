export type ShareRange = 'nickname-only' | 'nickname-ohaeng' | 'nickname-gender';

export interface SharePayloadInput {
  hapcard_id: string;
  mode: string;
  nickname: string;
  score: number;
  range: ShareRange;
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

export function buildSharePayload(input: SharePayloadInput): SharePayload {
  const { hapcard_id, mode, nickname, score, range, gender_normalized, ohaeng_counts, origin } = input;
  const nick = truncateNickname(nickname);
  const url = `${origin}/h/${hapcard_id}?mode=${mode}`;
  const title = `${nick}님과의 ${mode}`;

  let extra = '';
  if (range === 'nickname-ohaeng') {
    extra = ` · 오행: ${ohaengSummary(ohaeng_counts)}`;
  } else if (range === 'nickname-gender') {
    extra = ` · ${genderLabel(gender_normalized)}`;
  }

  const text = `${nick}님과의 합게이지: ${score}점${extra}`;

  return { title, text, url };
}
