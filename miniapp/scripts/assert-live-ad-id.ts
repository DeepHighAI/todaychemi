/**
 * assert-live-ad-id.ts — 프로덕션 빌드 산출물에 운영 배너 광고 그룹 ID 가
 * 실제로 인라인됐는지 검사하는 빌드 가드(assert-no-test-ad-id.ts 의 짝).
 *
 * 배경: 배너 광고는 `VITE_TOSS_AD_GROUP_ID`(=.env.production 운영 ID) 가 빌드 시점에
 * 번들로 박혀야 동작한다. 빌드 모드/ env 로딩이 어긋나 ID 가 안 박히면 런타임에서
 * `resolveAdGroupId()` 가 null → 배너가 조용히 미렌더(공간조차 없음)된다.
 * 테스트 ID 금지(assert-no-test-ad-id)의 반대편 — 운영 ID "필수"를 빌드 단계에서 강제한다.
 *
 * 동작: vite.config.ts 의 generateBundle 훅에서 모든 청크 코드를 합쳐, 기대 운영 ID 가
 * 포함됐는지 검사한다. 프로덕션 빌드에서 기대 ID 가 비어 있으면 env 누락으로 실패한다.
 *
 * 이 스크립트는 Node 빌드 단계에서만 import 되며 클라이언트 번들에는 포함되지 않는다.
 */

/**
 * 합쳐진 번들 코드에서 기대 운영 광고 ID 가 누락됐으면 그 ID 를, 인라인됐거나
 * 강제 대상이 아니면(기대 ID 공란) null 을 반환한다. 프로덕션 필수 검사는
 * findLiveAdIdBuildFailure() 를 사용한다.
 */
export function findMissingLiveAdId(
  combinedCode: string,
  expectedId: string | undefined | null,
): string | null {
  const expected = expectedId?.trim();
  if (!expected) return null; // dev/미설정 빌드 — 강제하지 않음
  return combinedCode.includes(expected) ? null : expected;
}

export function findLiveAdIdBuildFailure(
  combinedCode: string,
  expectedId: string | undefined | null,
): string | null {
  const expected = expectedId?.trim();
  if (!expected) {
    return 'VITE_TOSS_AD_GROUP_ID (.env.production) is required for production builds with banners enabled.';
  }

  const missing = findMissingLiveAdId(combinedCode, expected);
  if (!missing) return null;

  return (
    `Live banner ad group ID "${missing}" was not found in the build output. ` +
    'VITE_TOSS_AD_GROUP_ID (.env.production) must be inlined for banners to render. ' +
    'Verify the production build loads .env.production.'
  );
}
