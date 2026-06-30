/**
 * ait-analytics.ts — 미니앱 경량 리텐션 계측 (오늘의 부적)
 *
 * 미니앱은 GA 가 없으므로 앱인토스 SDK 내장 로깅(`eventLog`)으로 이벤트를 토스 네이티브
 * 로깅에 전송한다. 별도 서버 라우트·GA 불필요. 샌드박스에서는 콘솔 출력, 실환경은 로그 시스템 기록.
 *
 * PII 금지(§5): params 는 chart 파생값(element/theme)만. 사용자 식별자·생일·별명 전송 금지.
 * 토스 인프라 전송이라 LLM ZDR 과 무관. 토스 외(브라우저 dev)에서는 브리지 부재로 throw/reject
 * 가능 → 호출자에게 전파하지 않는다(자기 무해화).
 */

import { eventLog } from '@apps-in-toss/web-framework';

import type { OhaengElement } from '@/types/chart';
import type { DailyTalismanTheme } from '@/lib/today/daily-talisman';

export type TalismanEventName = 'talisman_view' | 'talisman_start' | 'talisman_complete';

export interface TalismanEventParams {
  element: OhaengElement;
  theme: DailyTalismanTheme;
}

/** 오늘의 부적 리텐션 이벤트 1건을 토스 로깅으로 전송한다(실패 무해화). */
export function trackTalismanEvent(name: TalismanEventName, params: TalismanEventParams): void {
  try {
    const result = eventLog({
      log_name: name,
      log_type: 'event',
      params: { element: params.element, theme: params.theme },
    });
    // Promise 반환 시 reject 를 흡수(unhandled rejection 방지). 일부 환경은 undefined 반환.
    if (result && typeof (result as Promise<void>).catch === 'function') {
      (result as Promise<void>).catch(() => {});
    }
  } catch {
    // 토스 외 환경(네이티브 브리지 부재) — 계측은 best-effort, UI 동작에 영향 없음.
  }
}
