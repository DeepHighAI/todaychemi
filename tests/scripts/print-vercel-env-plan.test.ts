import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { VERCEL_ENV_ROWS, VERCEL_ENV_UNSET_KEYS } from '../../scripts/print-vercel-env-plan';
import { LAUNCH_ENV_CHECKS } from '../../scripts/verify-launch-env';

const PNPM = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const packageJson = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
) as { scripts: Record<string, string> };

describe('print-vercel-env-plan', () => {
  it('prints the launch Vercel env plan without secret values', () => {
    expect(packageJson.scripts['print:vercel-env-plan']).toBe('tsx scripts/print-vercel-env-plan.ts');
    expect(VERCEL_ENV_ROWS.map((row) => row.key)).toEqual(LAUNCH_ENV_CHECKS.map((check) => check.key));
    expect(LAUNCH_ENV_CHECKS.every((check) => check.severity === 'required')).toBe(true);
    expect([...VERCEL_ENV_UNSET_KEYS]).toEqual([
      'TOSS_PAYMENTS_CLIENT_KEY',
      'TOSS_PAYMENTS_SECRET_KEY',
    ]);

    const result = spawnSync(PNPM, ['print:vercel-env-plan'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Set these keys in both Production and Preview');
    expect(result.stdout).toContain('Keep these legacy aliases unset for launch');
    expect(result.stdout).toContain('pnpm verify:external-settings-readiness');
    expect(result.stdout).not.toMatch(/\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/);
    expect(result.stdout).not.toMatch(/\blive_sk_[A-Za-z0-9_-]{8,}\b/);
    expect(result.stdout).not.toMatch(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/);
  });
});
