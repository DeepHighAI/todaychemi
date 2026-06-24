export interface RewardNoticePayload {
  id: number;
  amount: number;
  isSignup?: boolean;
  title?: string;
}

let nextId = 1;
let current: RewardNoticePayload | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function showRewardNotice(payload: Omit<RewardNoticePayload, 'id'>) {
  current = { ...payload, id: nextId++ };
  emit();
}

export function clearRewardNotice(id?: number) {
  if (id !== undefined && current?.id !== id) return;
  current = null;
  emit();
}

export function getRewardNoticeSnapshot() {
  return current;
}

export function subscribeRewardNotice(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
