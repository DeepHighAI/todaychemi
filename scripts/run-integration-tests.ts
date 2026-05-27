import { spawnSync } from 'node:child_process';

const result = spawnSync(
  'pnpm',
  ['exec', 'vitest', 'run', 'tests/db/rls.integration.test.ts', '--reporter', 'verbose'],
  {
    env: { ...process.env, RUN_INTEGRATION: '1' },
    shell: process.platform === 'win32',
    stdio: 'inherit',
  },
);

process.exit(result.status ?? 1);
