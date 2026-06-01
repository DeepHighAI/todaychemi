import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { scanLaunchAuditArtifacts } from '../../scripts/verify-launch-audit-readiness';

const tempDirs: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'launch-audit-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('verify-launch-audit-readiness', () => {
  it('accepts the current launch audit deliverables', () => {
    expect(scanLaunchAuditArtifacts()).toEqual([]);
  });

  it('flags missing audit artifacts and package scripts', () => {
    const root = tempDir();
    writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts: {} }), 'utf8');

    const findings = scanLaunchAuditArtifacts(root);
    expect(findings).toEqual(
      expect.arrayContaining([
        {
          file: 'docs/qa/launch_readiness_2026-05-30.md',
          label: 'missing required launch artifact',
        },
        {
          file: 'package.json',
          label: 'missing or invalid script verify:launch-readiness',
        },
        {
          file: 'package.json',
          label: 'missing or invalid script verify:launch-waiting-state',
        },
        {
          file: 'package.json',
          label: 'missing or invalid script verify:known-external-blockers',
        },
        {
          file: 'package.json',
          label: 'missing or invalid script verify:external-settings-readiness',
        },
        {
          file: 'package.json',
          label: 'missing or invalid script e2e:auth',
        },
      ]),
    );
  });
});
