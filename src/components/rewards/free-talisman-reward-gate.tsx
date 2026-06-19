'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';

import { RewardPopup } from './reward-popup';

interface SessionReward {
  awarded?: boolean;
  reason?: string;
  signup_awarded?: boolean;
  daily_login_awarded?: boolean;
  amount_awarded?: number;
}

interface SessionRewardResponse {
  ok: true;
  reward?: SessionReward;
}

export function FreeTalismanRewardGate() {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const requestedRef = useRef(false);
  const [popup, setPopup] = useState<{ amount: number; isSignup: boolean } | null>(null);

  useEffect(() => {
    if (!pathname || pathname.startsWith('/onboarding')) return;
    if (requestedRef.current) return;

    requestedRef.current = true;

    void fetch('/api/rewards/session', { method: 'POST' })
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json().catch(() => null)) as SessionRewardResponse | null;
      })
      .then((body) => {
        const reward = body?.reward;
        if (!reward?.awarded) return;
        void queryClient.invalidateQueries({ queryKey: ['me-wallet'] });
        const amount = reward.amount_awarded ?? 0;
        if (amount > 0) {
          setPopup({ amount, isSignup: Boolean(reward.signup_awarded) });
        }
      })
      .catch(() => {
        // 보상 게이트는 UX를 막지 않는다. 다음 앱 진입에서 RPC 멱등성으로 다시 시도된다.
        requestedRef.current = false;
      });
  }, [pathname, queryClient]);

  if (!popup) return null;
  return (
    <RewardPopup
      open
      amount={popup.amount}
      isSignup={popup.isSignup}
      onClose={() => setPopup(null)}
    />
  );
}
