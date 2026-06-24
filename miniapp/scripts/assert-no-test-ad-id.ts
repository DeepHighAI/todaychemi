/**
 * assert-no-test-ad-id.ts — 프로덕션 빌드 산출물에 앱인토스 테스트 광고 그룹 ID 가
 * 인라인되는 것을 막는 빌드 가드.
 *
 * 배경: 앱인토스 콘솔은 출시 번들에 테스트 광고 그룹 ID(`ait-ad-test-*`)가 포함되어 있으면 반려한다.
 * dev-bearer 누수와 같은 계열 — `import.meta.env.DEV ? TEST_ID : null` 같은 죽은 분기의 문자열
 * 리터럴이 vite 8 / rolldown DCE 에서 제거되지 않아 번들에 그대로 남는다.
 *
 * dev-bearer 가드(assert-no-dev-bearer.ts)는 env "값"을 검사하지만, 이 버그는 소스 "리터럴"이라
 * 빌드 "산출물"을 스캔해야 한다. vite.config.ts 의 generateBundle 훅에서 각 청크 코드를 이 함수로
 * 검사하고, 마커가 발견되면 빌드를 실패시킨다.
 *
 * 이 스크립트는 vite.config 가 Node 빌드 단계에서 import 할 뿐, 클라이언트 번들에는 포함되지 않는다.
 */

// 토스 공식 테스트 광고 그룹 ID 4종(banner/native/interstitial/rewarded)을 모두 포함하는 substring.
export const FORBIDDEN_AD_MARKERS: readonly string[] = ['ait-ad-test'];

/** 주어진 코드 문자열에서 발견된 금지 테스트 광고 ID 마커 목록을 반환한다(없으면 빈 배열). */
export function findForbiddenAdMarkers(code: string): string[] {
  return FORBIDDEN_AD_MARKERS.filter((marker) => code.includes(marker));
}
