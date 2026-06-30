import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import aitDevtools from '@ait-co/devtools/unplugin';
import path from 'path';

import { assertNoDevBearerInBuild } from './scripts/assert-no-dev-bearer';
import { findForbiddenAdMarkers } from './scripts/assert-no-test-ad-id';
import { findLiveAdIdBuildFailure } from './scripts/assert-live-ad-id';

// 빌드 가드 플러그인: 산출물 청크에 앱인토스 테스트 광고 그룹 ID(ait-ad-test-*)가 인라인되면 빌드 실패.
// dev-bearer 가드는 env 값을 검사하지만, 테스트 광고 ID 는 소스 리터럴이라 산출물 자체를 스캔해야 한다.
// (앱인토스 콘솔은 번들에 테스트 광고 ID 가 있으면 출시를 반려한다.)
function assertNoTestAdIdPlugin(): Plugin {
  return {
    name: 'assert-no-test-ad-id',
    generateBundle(_options, bundle) {
      for (const [fileName, output] of Object.entries(bundle)) {
        const code =
          output.type === 'chunk'
            ? output.code
            : typeof output.source === 'string'
              ? output.source
              : '';
        if (!code) continue;
        const hits = findForbiddenAdMarkers(code);
        if (hits.length > 0) {
          throw new Error(
            `Test ad group ID marker(s) [${hits.join(', ')}] found in build output (${fileName}). ` +
              'Apps in Toss rejects bundles containing test ad group IDs. ' +
              'Set live ad group IDs in .env.production; dev test IDs belong in .env.development only.',
          );
        }
      }
    },
  };
}

// 빌드 가드 플러그인: 프로덕션 빌드 산출물에 운영 배너 광고 ID(VITE_TOSS_AD_GROUP_ID)가
// 실제로 인라인됐는지 검증. 미인라인 시 런타임에서 resolveAdGroupId()=null → 배너가 조용히 미렌더된다.
// (테스트 ID 금지 가드의 반대편 — 운영 ID 필수를 빌드 단계에서 강제.)
function assertLiveAdIdPlugin(expectedAdGroupId: string | undefined): Plugin {
  return {
    name: 'assert-live-ad-id',
    generateBundle(_options, bundle) {
      const combined = Object.values(bundle)
        .map((output) =>
          output.type === 'chunk'
            ? output.code
            : typeof output.source === 'string'
              ? output.source
              : '',
        )
        .join('\n');
      const failure = findLiveAdIdBuildFailure(combined, expectedAdGroupId);
      if (failure) throw new Error(failure);
    },
  };
}

// P0 호환성 스파이크용 Vite 설정.
// @/ 별칭 → src/ 루트 (웹앱 import 경로와 동일하게 유지)
// 앱인토스 devtools: 목 SDK alias + 플로팅 패널 자동 주입 (dev 전용, 프로덕션 빌드 자동 비활성).
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, __dirname);
  // 빌드 가드: 프로덕션 산출물에 dev-bearer JWT 가 인라인되면 빌드 실패(자격증명 유출 방지).
  // 런타임 DEV 게이트만으론 토큰 문자열이 번들에서 안 잘리므로(vite8/rolldown) 빌드 시점에 차단.
  assertNoDevBearerInBuild({ command, devBearer: env.VITE_DEV_BEARER });

  // 운영 ID 인라인 강제는 실제 프로덕션 빌드에서만(개발 모드 빌드의 테스트 ID 와 충돌 방지).
  const enforceLiveAdId = command === 'build' && mode === 'production';

  return {
    plugins: [
      react(),
      aitDevtools.vite(),
      assertNoTestAdIdPlugin(),
      ...(enforceLiveAdId ? [assertLiveAdIdPlugin(env.VITE_TOSS_AD_GROUP_ID)] : []),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    // 로컬 테스트(dev 전용): /api/* 를 로컬 백엔드로 프록시 → 동일 오리진이라 CORS 불필요.
    // devtools 자체 엔드포인트(/api/ait-devtools/*)는 제외해 vite 가 직접 처리한다.
    // 백엔드 포트가 3001 이 아니면(보통 3000) target 을 맞춘다. server.proxy 는 프로덕션 빌드(.ait)에 영향 없음.
    server: {
      proxy: {
        '^/api/(?!ait-devtools)': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  };
});
