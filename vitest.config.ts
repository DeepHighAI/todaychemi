import { defineConfig, configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs';

function loadDotEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadDotEnvLocal();

const includeIntegrationTests = process.env.RUN_INTEGRATION === '1';

export default defineConfig({
  plugins: [react()],
  test: {
    // node 기본값 유지 — 컴포넌트 테스트 파일은 파일 첫 줄에
    // // @vitest-environment jsdom 주석으로 개별 지정
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup/dom.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    // The full launch suite mixes many jsdom files with route/unit tests. On
    // Windows, the default worker count can over-spawn during cold starts and
    // fail before assertions run, so keep enough parallelism without saturating
    // child-process startup.
    maxWorkers: 4,
    // Claude agent worktrees 는 자체 테스트 파일을 포함하므로 메인 repo
    // vitest 발견에서 제외. configDefaults.exclude 보존 의무.
    exclude: [
      ...configDefaults.exclude,
      '.claude/worktrees/**',
      'tests/e2e/**',
      ...(includeIntegrationTests ? [] : ['**/*.integration.test.ts']),
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
