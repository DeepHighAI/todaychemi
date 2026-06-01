import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { scanWaitingStateArtifacts } from '../../scripts/verify-launch-waiting-state';

const tempDirs: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'launch-waiting-state-'));
  tempDirs.push(dir);
  return dir;
}

function write(root: string, path: string, content: string) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content, 'utf8');
}

function summaryJson(requiredFailures = ['launch env', 'Auth readiness']) {
  return JSON.stringify(
    {
      generatedAt: '2026-05-31T16:01:01.151Z',
      cwd: 'C:\\DEV\\SAJU',
      verdict: 'FAIL',
      requiredFailures,
      results: [],
    },
    null,
    2,
  );
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('verify-launch-waiting-state artifact scan', () => {
  it('accepts launch evidence generated from the matching summary JSON', () => {
    const root = tempDir();
    write(root, 'summary.json', summaryJson());
    write(root, 'evidence.md', [
      '# Launch Evidence - TBD',
      '| Field | Value |',
      '|---|---|',
      '| Source summary JSON | summary.json |',
      '| Launch readiness verdict | FAIL |',
      '| Go/No-Go | 오픈 보류 |',
      '',
      '| Gate | Required Action |',
      '|---|---|',
      '| launch env | Must be cleared before production open |',
      '| Auth readiness | Must be cleared before production open |',
    ].join('\n'));

    expect(scanWaitingStateArtifacts('summary.json', 'evidence.md', root)).toEqual([]);
  });

  it('flags stale evidence that does not match the summary failure set', () => {
    const root = tempDir();
    write(root, 'summary.json', summaryJson(['OpenAI/ZDR readiness']));
    write(root, 'evidence.md', [
      '# Launch Evidence - Production',
      '| Source summary JSON | other-summary.json |',
      '| Launch readiness verdict | PASS |',
      '| Go/No-Go | 조건부 가능 |',
      '| launch env | Must be cleared before production open |',
    ].join('\n'));

    const findings = scanWaitingStateArtifacts('summary.json', 'evidence.md', root);
    expect(findings.map((finding) => finding.label)).toEqual(
      expect.arrayContaining([
        'evidence does not reference the provided summary JSON',
        'evidence does not record FAIL launch readiness verdict',
        'evidence does not record 오픈 보류 Go/No-Go',
        'evidence missing required failure row: OpenAI/ZDR readiness',
        'evidence required failure rows do not exactly match summary JSON',
      ]),
    );
  });

  it('flags evidence with extra stale required-failure rows', () => {
    const root = tempDir();
    write(root, 'summary.json', summaryJson(['launch env']));
    write(root, 'evidence.md', [
      '# Launch Evidence - TBD',
      '| Field | Value |',
      '|---|---|',
      '| Source summary JSON | summary.json |',
      '| Launch readiness verdict | FAIL |',
      '| Go/No-Go | 오픈 보류 |',
      '',
      '| Gate | Required Action |',
      '|---|---|',
      '| launch env | Must be cleared before production open |',
      '| Vercel readiness | Must be cleared before production open |',
    ].join('\n'));

    expect(scanWaitingStateArtifacts('summary.json', 'evidence.md', root)).toEqual([
      {
        file: 'evidence.md',
        label: 'evidence required failure rows do not exactly match summary JSON',
      },
    ]);
  });
});
