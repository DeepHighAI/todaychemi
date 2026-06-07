export const SHARE_OHAENG_ORDER = ['목', '화', '토', '금', '수'] as const;

export const SHARE_MODE_LABELS: Record<string, string> = {
  일합: '일 관계',
  친구합: '친구 관계',
  돈합: '돈 관계',
  첫합: '첫 만남',
  썸합: '썸 관계',
  오래합: '오래된 관계',
};

export function formatShareModeLabel(mode: string): string {
  return SHARE_MODE_LABELS[mode] ?? mode;
}

export function truncateShareNickname(nickname: string, maxLength = 30): string {
  if (nickname.length <= maxLength) return nickname;
  return nickname.slice(0, maxLength) + '…';
}

export function formatShareGenderLabel(gender: 'F' | 'M'): string {
  return gender === 'F' ? '여성' : '남성';
}

export function formatShareOhaengSummary(counts: Record<string, number>): string {
  return SHARE_OHAENG_ORDER.map((key) => `${key}${counts[key] ?? 0}`).join(' ');
}
