import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf-8');

describe('UIDesign 토큰 — globals.css (§1.6)', () => {
  it('M3 primary tonal ramp 전체 포함 (--p-10 ~ --p-98)', () => {
    expect(css).toMatch(/--p-10:/);
    expect(css).toMatch(/--p-20:/);
    expect(css).toMatch(/--p-30:/);
    expect(css).toMatch(/--p-60:/);
    expect(css).toMatch(/--p-80:/);
    expect(css).toMatch(/--p-98:/);
  });

  it('M3 surface container 레벨 포함 (--surface-1/2/3)', () => {
    expect(css).toMatch(/--surface-1:/);
    expect(css).toMatch(/--surface-2:/);
    expect(css).toMatch(/--surface-3:/);
  });

  it('UIDesign 타입 스케일 포함 (--t-display-l ~ --t-mono)', () => {
    expect(css).toMatch(/--t-display-l:/);
    expect(css).toMatch(/--t-display:/);
    expect(css).toMatch(/--t-h1:/);
    expect(css).toMatch(/--t-h2:/);
    expect(css).toMatch(/--t-body:/);
    expect(css).toMatch(/--t-cap:/);
    expect(css).toMatch(/--t-mono:/);
  });

  it('letter-spacing 토큰 포함 (--ls-tight/snug)', () => {
    expect(css).toMatch(/--ls-tight:/);
    expect(css).toMatch(/--ls-snug:/);
  });

  it('radius 전체 세트 포함 (--r-xs ~ --r-pill)', () => {
    expect(css).toMatch(/--r-xs:/);
    expect(css).toMatch(/--r-sm:/);
    expect(css).toMatch(/--r-md:/);
    expect(css).toMatch(/--r-lg:/);
    expect(css).toMatch(/--r-xl:/);
    expect(css).toMatch(/--r-pill:/);
  });

  it('M3 elevation 토큰 포함 (--e-1/2/3)', () => {
    expect(css).toMatch(/--e-1:/);
    expect(css).toMatch(/--e-2:/);
    expect(css).toMatch(/--e-3:/);
  });

  it('Pretendard JP --font-display 포함', () => {
    expect(css).toMatch(/--font-display:/);
    expect(css).toMatch(/Pretendard/);
  });

  it('스페이싱 토큰 포함 (--s-1 ~ --s-10)', () => {
    expect(css).toMatch(/--s-1:/);
    expect(css).toMatch(/--s-4:/);
    expect(css).toMatch(/--s-10:/);
  });
});
