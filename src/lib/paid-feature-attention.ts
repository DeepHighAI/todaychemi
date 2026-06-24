import { todayKST } from '@/lib/today/kst-date';

export type PaidFeatureAttentionId = 'hapcard' | 'whatif' | 'replay';

const STORAGE_KEY = 'twoday_paid_feature_clicks_v1';

function readState(): Partial<Record<PaidFeatureAttentionId, string>> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<Record<PaidFeatureAttentionId, string>>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeState(state: Partial<Record<PaidFeatureAttentionId, string>>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage 차단 환경에서는 점 표시만 세션 기본값으로 둔다.
  }
}

export function hasClickedPaidFeatureToday(
  feature: PaidFeatureAttentionId,
  targetDate = todayKST(),
): boolean {
  return readState()[feature] === targetDate;
}

export function shouldShowPaidFeatureAttention(
  feature: PaidFeatureAttentionId,
  targetDate = todayKST(),
): boolean {
  return !hasClickedPaidFeatureToday(feature, targetDate);
}

export function markPaidFeatureClickedToday(
  feature: PaidFeatureAttentionId,
  targetDate = todayKST(),
): void {
  writeState({ ...readState(), [feature]: targetDate });
}
