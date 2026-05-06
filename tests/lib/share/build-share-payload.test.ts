import { describe, expect, it } from 'vitest';
import { buildSharePayload } from '@/lib/share/build-share-payload';
import type { ShareRange } from '@/lib/share/build-share-payload';

const BASE_INPUT = {
  hapcard_id: 'hap-uuid-001',
  mode: '친구합',
  nickname: '봄달',
  score: 78,
  gender_normalized: 'F' as const,
  ohaeng_counts: { 목: 3, 화: 1, 토: 2, 금: 1, 수: 1 } as Record<string, number>,
  origin: 'https://hap.plae',
};

describe('buildSharePayload', () => {
  it('nickname-only → title·text·url 결정형 반환', () => {
    const result = buildSharePayload({ ...BASE_INPUT, range: 'nickname-only' });
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('text');
    expect(result).toHaveProperty('url');
    expect(typeof result.title).toBe('string');
    expect(typeof result.text).toBe('string');
    expect(typeof result.url).toBe('string');
  });

  it('nickname-only → text에 nickname·score 포함, 생일·시간·장소 0건', () => {
    const result = buildSharePayload({ ...BASE_INPUT, range: 'nickname-only' });
    expect(result.text).toContain('봄달');
    expect(result.text).toContain('78');
    expect(result.text).not.toMatch(/생일|birth_date|\d{4}-\d{2}-\d{2}/);
    expect(result.text).not.toMatch(/\d{2}:\d{2}/);
    expect(result.text).not.toMatch(/장소|birth_place/);
  });

  it('nickname-ohaeng → text에 오행 분포 포함, 생일 0건', () => {
    const result = buildSharePayload({ ...BASE_INPUT, range: 'nickname-ohaeng' });
    expect(result.text).toContain('목');
    expect(result.text).not.toMatch(/생일|\d{4}-\d{2}-\d{2}/);
  });

  it('nickname-gender → text에 성별 포함(여성/남성), 생일 0건', () => {
    const female = buildSharePayload({ ...BASE_INPUT, range: 'nickname-gender', gender_normalized: 'F' });
    expect(female.text).toMatch(/여성|남성/);
    expect(female.text).not.toMatch(/생일|\d{4}-\d{2}-\d{2}/);

    const male = buildSharePayload({ ...BASE_INPUT, range: 'nickname-gender', gender_normalized: 'M' });
    expect(male.text).toContain('남성');
  });

  it('url = origin/h/hapcardId?mode=mode&range=range 형식', () => {
    const result = buildSharePayload({ ...BASE_INPUT, range: 'nickname-only' });
    expect(result.url).toBe('https://hap.plae/h/hap-uuid-001?mode=친구합&range=nickname-only');
  });

  it('url에 range 쿼리 포함 — 3종 모두', () => {
    const ranges: ShareRange[] = ['nickname-only', 'nickname-ohaeng', 'nickname-gender'];
    for (const range of ranges) {
      const { url } = buildSharePayload({ ...BASE_INPUT, range });
      expect(url).toContain(`range=${range}`);
    }
  });

  it('동일 input → 동일 output (결정형)', () => {
    const a = buildSharePayload({ ...BASE_INPUT, range: 'nickname-only' });
    const b = buildSharePayload({ ...BASE_INPUT, range: 'nickname-only' });
    expect(a).toEqual(b);
  });

  it('nickname 30자 초과 시 절단 + 말줄임표', () => {
    const long = '가'.repeat(35);
    const result = buildSharePayload({ ...BASE_INPUT, nickname: long, range: 'nickname-only' });
    expect(result.text.length).toBeLessThan(long.length + 100);
    const truncated = '가'.repeat(30) + '…';
    expect(result.text).toContain(truncated);
  });
});
