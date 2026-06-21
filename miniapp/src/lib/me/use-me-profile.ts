/**
 * use-me-profile.ts — 내 프로필(닉네임·생년월일·성별 등) 단일 출처 쿼리 훅.
 *
 * `['me-profile']` 키를 MePage(히어로)·MeEditDrawer 가 공유한다(네트워크 dedup).
 * chart(ChartCore)는 PII 미포함이라 닉네임/생일이 없다 — 히어로 표시용 데이터는 이 훅에서.
 * GET /api/me 는 { ok, profile } 를 반환. 드로어의 기존 inline 쿼리는 같은 키라 캐시를 공유한다.
 * (닉네임/생일은 사용자 자신의 데이터를 자신에게 보여주는 UI 표시용 — LLM 페이로드엔 절대 미포함, §5.)
 */

import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';

export type Calendar = 'solar' | 'lunar';
export type TimeAccuracy = 'exact' | 'approximate' | 'unknown';

export interface MeProfile {
  nickname: string;
  birth_date: string;
  birth_date_calendar: Calendar;
  is_lunar_leap: boolean;
  birth_time_knowledge: TimeAccuracy;
  birth_time: string | null;
  gender: 'M' | 'F';
}

export function useMeProfile(token: string | null) {
  return useQuery({
    queryKey: ['me-profile'],
    enabled: !!token,
    queryFn: async (): Promise<MeProfile> => {
      const res = await apiFetch<{ ok: boolean; profile: MeProfile }>('/api/me', { token });
      return res.profile;
    },
  });
}
