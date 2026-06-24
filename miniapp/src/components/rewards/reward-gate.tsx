/**
 * reward-gate.tsx — 부적 지급 트리거 (항목 6/7)
 *
 * 앱 진입 시 1회 POST /api/rewards/session 를 호출해 가입(+100)·매일 출석(+10) 부적을
 * 지급받는다. 지급이 발생하면 비모달 RewardNotice 로 안내하고 지갑 쿼리를 무효화한다.
 *
 * - 온보딩 경로(/onboarding)에서는 호출하지 않는다(프로필 생성 전이라 PROFILE_REQUIRED).
 * - RPC 는 멱등(이미 지급 시 ALREADY_AWARDED) — 마운트마다 재호출돼도 팝업은 실제 지급 1회만.
 * - 웹앱 FreeTalismanRewardGate(src/components/rewards) 와 동일 역할의 미니앱 포트.
 */

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { showRewardNotice } from './reward-notice-store';

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

export function RewardGate() {
  const location = useLocation();
  const { token, isAuthed } = useAuth();
  const queryClient = useQueryClient();
  const requestedRef = useRef(false);

  useEffect(() => {
    if (!isAuthed) return;
    // 온보딩 중에는 프로필이 없어 지급 불가 — 호출 건너뜀(웹 게이트와 동일).
    if (location.pathname.startsWith('/onboarding')) return;
    if (requestedRef.current) return;
    requestedRef.current = true;

    void apiFetch<SessionRewardResponse>('/api/rewards/session', { method: 'POST', token })
      .then((body) => {
        const reward = body?.reward;
        if (!reward?.awarded) return;
        void queryClient.invalidateQueries({ queryKey: ['me-wallet'] });
        const amount = reward.amount_awarded ?? 0;
        if (amount > 0) {
          showRewardNotice({ amount, isSignup: Boolean(reward.signup_awarded) });
        }
      })
      .catch(() => {
        // 보상 게이트는 UX 를 막지 않는다 — 다음 앱 진입에서 RPC 멱등성으로 재시도된다.
        requestedRef.current = false;
      });
  }, [isAuthed, location.pathname, token, queryClient]);

  return null;
}
