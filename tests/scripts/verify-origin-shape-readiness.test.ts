import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const scripts = [
  'verify-launch-env.ts',
  'verify-auth-readiness.ts',
  'verify-vercel-readiness.ts',
  'verify-toss-live-readiness.ts',
];

const packageJson = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
) as { scripts: Record<string, string> };
const PNPM = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

function readScript(name: string): string {
  return readFileSync(new URL(`../../scripts/${name}`, import.meta.url), 'utf8');
}

describe('production origin readiness checks', () => {
  it('rejects app URLs that are not pure https production origins', () => {
    for (const script of scripts) {
      const source = readScript(script);
      expect(source, script).toMatch(/url\.protocol\s*(?:===|!==)\s*'https:'/);
      expect(source, script).toMatch(/url\.hostname\s*(?:===|!==)\s*'localhost'/);
      expect(source, script).toMatch(/url\.hostname\s*(?:===|!==)\s*'127\.0\.0\.1'/);
      expect(source, script).toMatch(/url\.pathname\s*(?:===|!==)\s*'\/'/);
      expect(source, script).toMatch(/url\.search\s*(?:===|!==)\s*''/);
      expect(source, script).toMatch(/url\.hash\s*(?:===|!==)\s*''/);
      expect(source, script).toMatch(/!?(?:value|origin)\.endsWith\('\/'\)/);
    }
  });

  it('exposes a direct operator command for checking the MVP production origin', () => {
    expect(packageJson.scripts['verify:origin-shape-readiness']).toBe('tsx scripts/verify-origin-shape-readiness.ts');

    const result = spawnSync(PNPM, ['verify:origin-shape-readiness', '--', '--origin', 'https://twoday-mvp.vercel.app'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Production origin shape readiness PASS');
    expect(result.stdout).toContain('Supabase Redirect URL: https://twoday-mvp.vercel.app/auth/callback');
    expect(result.stdout).toContain('Toss Success URL: https://twoday-mvp.vercel.app/api/payments/feature/confirm');
  });
});
