import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { normalizeBaseUrl, parseArgs } from '../../scripts/run-e2e';

const source = readFileSync(new URL('../../scripts/run-e2e.ts', import.meta.url), 'utf8');
const launchRunbook = readFileSync(new URL('../../docs/runbooks/launch_opening.md', import.meta.url), 'utf8');
const evidenceTemplate = readFileSync(new URL('../../docs/qa/launch_evidence_template.md', import.meta.url), 'utf8');

describe('run-e2e launch URL handling', () => {
  it('supports shell-neutral --base-url for preview/production smoke', () => {
    expect(parseArgs(['--base-url', 'https://twoday-mvp.vercel.app', '--grep', '@auth'])).toEqual({
      baseUrl: 'https://twoday-mvp.vercel.app',
      playwrightArgs: ['--grep', '@auth'],
    });
    expect(parseArgs(['--base-url=https://preview.vercel.app/'])).toEqual({
      baseUrl: 'https://preview.vercel.app',
      playwrightArgs: [],
    });
    expect(source).toContain('PLAYWRIGHT_BASE_URL: baseUrl');
  });

  it('rejects non-origin or non-http base URLs before Playwright runs', () => {
    expect(() => normalizeBaseUrl('twoday-mvp.vercel.app')).toThrow('--base-url must be an absolute http(s) origin');
    expect(() => normalizeBaseUrl('ftp://twoday-mvp.vercel.app')).toThrow('--base-url must use http or https');
    expect(() => normalizeBaseUrl('https://twoday-mvp.vercel.app/login')).toThrow(
      '--base-url must be an origin without path, query, hash, or credentials',
    );
    expect(() => normalizeBaseUrl('https://user:pass@twoday-mvp.vercel.app')).toThrow(
      '--base-url must be an origin without path, query, hash, or credentials',
    );
  });

  it('documents --base-url launch smoke commands instead of shell-specific env assignment', () => {
    expect(launchRunbook).toContain('pnpm e2e -- --base-url https://<preview-url>');
    expect(launchRunbook).toContain('pnpm e2e:auth -- --base-url https://<production-origin>');
    expect(evidenceTemplate).toContain('pnpm e2e -- --base-url <url>');
    expect(evidenceTemplate).not.toContain('PLAYWRIGHT_BASE_URL=<url> pnpm e2e');
  });
});
