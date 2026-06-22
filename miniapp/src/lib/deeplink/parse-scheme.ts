/**
 * parse-scheme.ts — 콜드스타트 스킴 URI → 앱 라우트 경로 파서
 *
 * 토스가 딥링크로 미니앱을 실행하면 getSchemeUri() 가 초기 진입 스킴을 반환한다.
 * WebView 는 기본 URL에서 시작하므로, 스킴의 경로를 직접 파싱해
 * MemoryRouter 경로로 이동시켜야 공유 링크(케미카드 등)가 동작한다.
 *
 * 지원 스킴 형식:
 *   - 운영:  intoss://todaychemi/hapcard/abc123
 *            intoss://todaychemi/feed/rel-1?x=1
 *   - 테스트: 콘솔 업로드 산출물의 private 테스트 스킴
 *
 * 보안: 임의 경로 이동을 막기 위해 알려진 라우트 prefix allowlist 로 제한한다.
 *
 * 출처: 구현 레퍼런스 §5(lifecycle/deeplink), getSchemeUri 공식 문서.
 */

/** 콜드스타트 진입을 허용하는 라우트 prefix (routes.tsx 와 정합) */
const ALLOWED_ROUTE_PREFIXES: readonly string[] = [
  'hapcard',
  'whatif',
  'feed',
  'me',
  'onboarding',
  'relations',
  'legal',
];

/** 토스 프레임워크 전용 쿼리 키 — 앱 경로 매핑에서 무시 */
const FRAMEWORK_QUERY_KEYS: ReadonlySet<string> = new Set(['_deploymentId']);

/**
 * 스킴 URI 에서 앱 라우트 경로(`/hapcard/abc123` 형태)를 추출한다.
 *
 * @param schemeUri - getSchemeUri() 반환값 (없거나 빈 문자열 가능)
 * @returns 이동할 경로(`/`로 시작) 또는 null (루트 유지 / 미지원 경로)
 */
export function parseSchemeToPath(schemeUri: string | null | undefined): string | null {
  if (!schemeUri || typeof schemeUri !== 'string') return null;

  // 1. 스킴 구분자 제거
  const schemeSep = schemeUri.indexOf('://');
  if (schemeSep === -1) return null;
  const afterScheme = schemeUri.slice(schemeSep + 3); // "host/path?query"

  // 2. host 와 path?query 분리 — 첫 '/' 기준
  const firstSlash = afterScheme.indexOf('/');
  if (firstSlash === -1) return null; // host 만 있음 → 루트 유지
  const pathAndQuery = afterScheme.slice(firstSlash + 1); // "path/seg?query"

  // 3. path 와 query 분리
  const qIndex = pathAndQuery.indexOf('?');
  const rawPath = qIndex === -1 ? pathAndQuery : pathAndQuery.slice(0, qIndex);
  const rawQuery = qIndex === -1 ? '' : pathAndQuery.slice(qIndex + 1);

  // 4. path 정규화 — 앞뒤 슬래시 정리, 빈 세그먼트 제거
  const segments = rawPath.split('/').map((s) => s.trim()).filter(Boolean);
  if (segments.length === 0) return null; // 경로 없음 → 루트 유지

  // 5. allowlist 검증 — 첫 세그먼트가 알려진 라우트여야 함
  const head = segments[0].toLowerCase();
  if (!ALLOWED_ROUTE_PREFIXES.includes(head)) return null;

  // 6. 프레임워크 전용 쿼리 제거 후 앱 쿼리만 보존
  const appQuery = filterAppQuery(rawQuery);

  const path = '/' + segments.join('/');
  return appQuery ? `${path}?${appQuery}` : path;
}

/** 프레임워크 전용 쿼리 키(_deploymentId 등)를 제거하고 앱 쿼리 문자열만 반환 */
function filterAppQuery(rawQuery: string): string {
  if (!rawQuery) return '';
  const parts: string[] = [];
  for (const pair of rawQuery.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const key = eq === -1 ? pair : pair.slice(0, eq);
    if (FRAMEWORK_QUERY_KEYS.has(key)) continue;
    parts.push(pair);
  }
  return parts.join('&');
}
