export const SHARE_OHAENG_ORDER = ['목', '화', '토', '금', '수'] as const;

export const SHARE_MODE_LABELS: Record<string, string> = {
  일합: '일로 연결된 사이',
  친구합: '친구 사이',
  돈합: '돈이 오가는 사이',
  첫합: '처음 보는 사이',
  썸합: '끌리는 사이',
  오래합: '오래 알고 지낸 사이',
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
