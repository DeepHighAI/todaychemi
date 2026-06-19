/**
 * use-me-chart.ts — 본명식(chart) 단일 출처 쿼리 훅.
 *
 * `['me-chart']` 키를 ProfileGate·HomePage·MePage 가 공유한다(네트워크 1회 dedup).
 * 에러를 흡수하지 않고 그대로 throw 시켜(react-query `isError`) "확정 미등록(chart=null)"과
 * "조회 실패"를 구분한다 — 이전에는 각 페이지가 try/catch→null 로 흡수해 둘을 혼동했고,
 * 같은 키에 서로 다른 shape(ChartMinimal vs ChartCore)를 넣어 잠재 크래시가 있었다.
 * 반환은 API 가 주는 full `ChartCore | null` 로 통일한다.
 */

import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import type { ChartCore } from '@/types/chart';

export function useMeChart(token: string | null) {
  return useQuery({
    queryKey: ['me-chart'],
    // 토큰이 준비되기 전엔 발화 금지 — null-token 으로 한 번 호출되면 ProfileGate·HomePage·MePage
    // 가 공유하는 ['me-chart'] 캐시에 인증 실패 결과가 박혀 자가 치유되지 않는다(토큰은 user-scoped
    // 라 queryKey 에 넣지 않고 enabled 가드로만 처리; 재로그인 후 401-retry 가 본문을 갱신).
    enabled: !!token,
    queryFn: async (): Promise<ChartCore | null> => {
      const res = await apiFetch<{ ok: boolean; chart: ChartCore | null }>('/api/me/chart', {
        token,
      });
      return res.chart ?? null;
    },
  });
}
