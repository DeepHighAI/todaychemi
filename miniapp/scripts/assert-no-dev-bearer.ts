/**
 * assert-no-dev-bearer.ts — 프로덕션 빌드에 dev-bearer JWT가 인라인되는 것을 막는 빌드 가드.
 *
 * 배경(2026-06-22, .ait 재빌드에서 발견): `import.meta.env.DEV ? VITE_DEV_BEARER : undefined`
 * 런타임 게이트는 토큰의 "사용"만 막을 뿐, vite 8 / rolldown 빌드는 dead-branch 문자열 리터럴을
 * DCE하지 못해 `.env.local` 에 `VITE_DEV_BEARER` 가 있으면 프로덕션 `.ait` 번들에 토큰이 그대로
 * 인라인된다(자격증명 유출). 따라서 빌드 시점에 차단한다.
 *
 * vite.config.ts 의 config 함수에서 `loadEnv` 로 해석한 VITE_DEV_BEARER 를 넘겨 호출한다.
 * `command === 'build'`(프로덕션 산출물)인데 토큰이 비어있지 않으면 빌드를 실패시킨다.
 * `command === 'serve'`(dev 서버)는 dev-bearer 가 정당하므로 통과.
 */

export interface AssertNoDevBearerOptions {
  /** vite config 의 command — 'build'(산출물) | 'serve'(dev 서버) */
  command: 'build' | 'serve';
  /** loadEnv 로 해석된 VITE_DEV_BEARER 값 */
  devBearer: string | undefined;
}

export function assertNoDevBearerInBuild({ command, devBearer }: AssertNoDevBearerOptions): void {
  if (command !== 'build') return;
  if (devBearer && devBearer.trim().length > 0) {
    throw new Error(
      'VITE_DEV_BEARER is set during a production build — it would be inlined into the .ait bundle. ' +
        'The import.meta.env.DEV runtime gate does NOT strip the token string under vite 8 / rolldown. ' +
        'Blank VITE_DEV_BEARER in miniapp/.env.local before building ' +
        '(re-mint later for local dev with `pnpm mint:dev-bearer --write`).',
    );
  }
}
