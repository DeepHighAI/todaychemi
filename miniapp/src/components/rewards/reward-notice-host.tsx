import { useSyncExternalStore } from 'react';

import { RewardNotice } from './reward-notice';
import {
  clearRewardNotice,
  getRewardNoticeSnapshot,
  subscribeRewardNotice,
} from './reward-notice-store';

export function RewardNoticeHost() {
  const notice = useSyncExternalStore(
    subscribeRewardNotice,
    getRewardNoticeSnapshot,
    getRewardNoticeSnapshot,
  );

  if (!notice) return null;
  return (
    <RewardNotice
      amount={notice.amount}
      isSignup={Boolean(notice.isSignup)}
      title={notice.title}
      onClose={() => clearRewardNotice(notice.id)}
    />
  );
}
