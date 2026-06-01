import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const PNPM = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const packageJson = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
) as { scripts: Record<string, string> };

describe('print-launch-dashboard-plan', () => {
  it('prints a Korean secret-free launch dashboard setup sequence', () => {
    expect(packageJson.scripts['print:launch-dashboard-plan']).toBe('tsx scripts/print-launch-dashboard-plan.ts');

    const result = spawnSync(PNPM, ['print:launch-dashboard-plan', '--', '--origin', 'https://twoday-mvp.vercel.app'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Launch dashboard setup plan');
    expect(result.stdout).toContain('목적: Vercel 기본 Production URL로 MVP를 열기 위한 외부 대시보드 작업 순서.');
    expect(result.stdout).toContain('Supabase Redirect URL: https://twoday-mvp.vercel.app/auth/callback');
    expect(result.stdout).toContain('Toss Success URL: https://twoday-mvp.vercel.app/api/payments/confirm');
    expect(result.stdout).toContain('pnpm verify:launch-readiness -- --summary-json');
    expect(result.stdout).not.toMatch(/\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/);
    expect(result.stdout).not.toMatch(/\blive_sk_[A-Za-z0-9_-]{8,}\b/);
    expect(result.stdout).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  });

  it('fails fast when the provided origin is not a production origin', () => {
    const result = spawnSync(PNPM, ['print:launch-dashboard-plan', '--', '--origin', 'https://twoday-mvp.vercel.app/auth/callback'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });

    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain('[origin] FAIL');
    expect(result.stdout).toContain('pnpm verify:origin-shape-readiness');
  });
});
