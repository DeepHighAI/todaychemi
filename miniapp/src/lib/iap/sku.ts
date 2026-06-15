/**
 * sku.ts — feature → Toss IAP SKU 매핑 단일 출처
 *
 * 환경변수 우선순위 (내림차순):
 *   1. 피처별 env: VITE_TOSS_IAP_SKU_<FEATURE> (대문자)
 *      예: VITE_TOSS_IAP_SKU_HAPCARD, VITE_TOSS_IAP_SKU_WHATIF, ...
 *   2. 맵 env: VITE_TOSS_IAP_SKU_MAP (JSON 문자열)
 *      예: '{"hapcard":"ait.xxx","whatif":"ait.yyy","replay":"ait.zzz","relation_slot":"ait.www"}'
 *   3. 위 둘 다 미설정 시 빈 문자열 반환 — IAP 호출 시 런타임 오류 발생
 *
 * 콘솔에서 발급받은 SKU 문자열(예: ait.0000010000.af647449...)을 env 에 등록.
 * 서버측 TOSS_IAP_SKU_MAP 과 동일 값을 유지해야 함 (§1.3 TODO: 단일 출처 추출 검토).
 *
 * .env.example 키 목록:
 *   VITE_TOSS_IAP_SKU_MAP={"hapcard":"","whatif":"","replay":"","relation_slot":""}
 *   # 또는 피처별:
 *   VITE_TOSS_IAP_SKU_HAPCARD=
 *   VITE_TOSS_IAP_SKU_WHATIF=
 *   VITE_TOSS_IAP_SKU_REPLAY=
 *   VITE_TOSS_IAP_SKU_RELATION_SLOT=
 */

export type IapFeature = 'hapcard' | 'whatif' | 'replay' | 'relation_slot';

/** feature → env 키 접미사 매핑 */
const FEATURE_ENV_KEY: Record<IapFeature, string> = {
  hapcard: 'HAPCARD',
  whatif: 'WHATIF',
  replay: 'REPLAY',
  relation_slot: 'RELATION_SLOT',
};

/** VITE_TOSS_IAP_SKU_MAP JSON 파싱 (1회 캐시) */
function parseSkuMap(): Partial<Record<IapFeature, string>> {
  const raw = import.meta.env.VITE_TOSS_IAP_SKU_MAP as string | undefined;
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Partial<Record<IapFeature, string>>;
  } catch {
    return {};
  }
}

let _cachedMap: Partial<Record<IapFeature, string>> | null = null;

function getSkuMap(): Partial<Record<IapFeature, string>> {
  if (_cachedMap === null) {
    _cachedMap = parseSkuMap();
  }
  return _cachedMap;
}

/**
 * feature 에 대응하는 Toss IAP SKU 문자열을 반환한다.
 * 피처별 env > 맵 env > 빈 문자열 순으로 우선순위를 적용한다.
 */
export function resolveIapSku(feature: IapFeature): string {
  // 1. 피처별 env
  const envKey = `VITE_TOSS_IAP_SKU_${FEATURE_ENV_KEY[feature]}`;
  const perFeature = (import.meta.env as Record<string, string | undefined>)[envKey];
  if (perFeature) return perFeature;

  // 2. 맵 env
  const fromMap = getSkuMap()[feature];
  if (fromMap) return fromMap;

  // 3. 미설정 — IAP 호출 시 빈 SKU 로 Toss 에서 실패
  return '';
}
