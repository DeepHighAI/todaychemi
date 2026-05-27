'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';

interface SessionRewardResponse {
  ok: true;
  reward?: {
    awarded?: boolean;
  };
}

export function FreeTalismanRewardGate() {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const requestedRef = useRef(false);

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
        if (body?.reward?.awarded) {
          void queryClient.invalidateQueries({ queryKey: ['me-wallet'] });
        }
      })
      .catch(() => {
        // 보상 게이트는 UX를 막지 않는다. 다음 앱 진입에서 RPC 멱등성으로 다시 시도된다.
      });
  }, [pathname, queryClient]);

  return null;
}
