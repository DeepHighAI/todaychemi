import { describe, it, expect } from 'vitest';
import { buildOgPayload, type OgPayloadInput } from '@/lib/og/render-payload';

const BASE: OgPayloadInput = {
  nickname: '봄달',
  score: 78,
  mode: '친구합',
  ohaeng_counts: { 목: 3, 화: 1, 토: 2, 금: 1, 수: 1 },
  gender_normalized: 'F',
};

describe('buildOgPayload', () => {
  it('nickname-only → nickname/score/오늘온도/mode/range만 포함, ohaeng/gender 미포함', () => {
    const result = buildOgPayload(BASE, 'nickname-only');
    expect(result.nickname).toBe('봄달');
    expect(result.score).toBe(78);
    expect(result.temperature_label).toBe('38.4°C');
    expect(result.mode).toBe('친구 사이');
    expect(result.range).toBe('nickname-only');
    expect(result.ohaeng_counts).toBeUndefined();
    expect(result.gender_normalized).toBeUndefined();
  });

  it('nickname-ohaeng → ohaeng_counts 포함, gender 미포함', () => {
    const result = buildOgPayload(BASE, 'nickname-ohaeng');
    expect(result.ohaeng_counts).toEqual({ 목: 3, 화: 1, 토: 2, 금: 1, 수: 1 });
    expect(result.gender_normalized).toBeUndefined();
  });

  it('nickname-gender → gender_normalized 포함, ohaeng 미포함', () => {
    const result = buildOgPayload(BASE, 'nickname-gender');
    expect(result.gender_normalized).toBe('F');
    expect(result.ohaeng_counts).toBeUndefined();
  });

  it('nickname 30자 초과 시 절단 + 말줄임표', () => {
    const long = '가'.repeat(40);
    const result = buildOgPayload({ ...BASE, nickname: long }, 'nickname-only');
    expect(result.nickname).toBe('가'.repeat(30) + '…');
  });

  it('PII 5필드(birth_date/name/email/birth_place/gender 원본) 페이로드에 없음', () => {
    const result = buildOgPayload(BASE, 'nickname-gender');
    const keys = Object.keys(result);
    expect(keys).not.toContain('birth_date');
    expect(keys).not.toContain('name');
    expect(keys).not.toContain('email');
    expect(keys).not.toContain('birth_place');
    expect(keys).not.toContain('gender');
  });

  it('동일 input → 동일 output (결정형)', () => {
    const a = buildOgPayload(BASE, 'nickname-only');
    const b = buildOgPayload(BASE, 'nickname-only');
    expect(a).toEqual(b);
  });
});
