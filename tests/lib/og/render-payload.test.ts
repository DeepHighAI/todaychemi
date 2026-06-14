import { describe, it, expect } from 'vitest';
import {
  buildOgPayload,
  deriveShareAreaScores,
  parseShareOhaengCountsParam,
  rangeToLayoutOptions,
  layoutToShareRange,
  serializeShareOhaengCounts,
  type OgPayloadInput,
} from '@/lib/og/render-payload';

const BASE: OgPayloadInput = {
  nickname: '봄달',
  score: 78,
  mode: '친구합',
  ohaeng_counts: { 목: 3, 화: 1, 토: 2, 금: 1, 수: 1 },
  gender_normalized: 'F',
  radar: {
    user: { 목: 2, 화: 1, 토: 2, 금: 1, 수: 2 },
    relation: { 목: 3, 화: 1, 토: 2, 금: 1, 수: 1 },
  },
  headline: '동료감이 큰 사이예요',
  flow_scores: [60, 65, 70, 78],
};

describe('buildOgPayload — layout 기반', () => {
  it('combined → 오행·영역·한 줄을 한 payload 에 포함', () => {
    const r = buildOgPayload(
      { ...BASE, area_scores: { talk: 80, attract: 74, speed: 62, money: 55, future: 68 } },
      { layout: 'combined', showGender: false },
    );
    expect(r.layout).toBe('combined');
    expect(r.ohaeng_counts).toEqual({ 목: 3, 화: 1, 토: 2, 금: 1, 수: 1 });
    expect(r.area_scores).toEqual({ talk: 80, attract: 74, speed: 62, money: 55, future: 68 });
    expect(r.headline).toBe('동료감이 큰 사이예요');
    expect(r.flow_scores).toBeUndefined();
  });

  it('minimal → 공통 필드만, 레이아웃별 데이터·gender 미포함', () => {
    const r = buildOgPayload(BASE, { layout: 'minimal', showGender: false });
    expect(r.nickname).toBe('봄달');
    expect(r.score).toBe(78);
    expect(r.temperature_label).toBe('38.4°C');
    expect(r.mode).toBe('친구 관계');
    expect(r.layout).toBe('minimal');
    expect(r.showGender).toBe(false);
    expect(r.ohaeng_counts).toBeUndefined();
    expect(r.radar).toBeUndefined();
    expect(r.headline).toBeUndefined();
    expect(r.flow_scores).toBeUndefined();
    expect(r.gender_normalized).toBeUndefined();
  });

  it('ohaeng → ohaeng_counts 포함', () => {
    const r = buildOgPayload(BASE, { layout: 'ohaeng', showGender: false });
    expect(r.ohaeng_counts).toEqual({ 목: 3, 화: 1, 토: 2, 금: 1, 수: 1 });
    expect(r.radar).toBeUndefined();
  });

  it('radar → 나 vs 인연 오행 오버레이 포함', () => {
    const r = buildOgPayload(BASE, { layout: 'radar', showGender: false });
    expect(r.radar).toEqual({
      user: { 목: 2, 화: 1, 토: 2, 금: 1, 수: 2 },
      relation: { 목: 3, 화: 1, 토: 2, 금: 1, 수: 1 },
    });
    expect(r.ohaeng_counts).toBeUndefined();
  });

  it('comment → headline 포함', () => {
    const r = buildOgPayload(BASE, { layout: 'comment', showGender: false });
    expect(r.headline).toBe('동료감이 큰 사이예요');
  });

  it('flow → flow_scores 포함', () => {
    const r = buildOgPayload(BASE, { layout: 'flow', showGender: false });
    expect(r.flow_scores).toEqual([60, 65, 70, 78]);
  });

  it('showGender=true → gender_normalized 노출 (레이아웃과 직교)', () => {
    const r = buildOgPayload(BASE, { layout: 'minimal', showGender: true });
    expect(r.gender_normalized).toBe('F');
    expect(r.showGender).toBe(true);
  });

  it('showGender=false → gender_normalized 미포함', () => {
    const r = buildOgPayload(BASE, { layout: 'minimal', showGender: false });
    expect(r.gender_normalized).toBeUndefined();
  });

  it('nickname 30자 초과 시 절단 + 말줄임표', () => {
    const long = '가'.repeat(40);
    const r = buildOgPayload({ ...BASE, nickname: long }, { layout: 'minimal', showGender: false });
    expect(r.nickname).toBe('가'.repeat(30) + '…');
  });

  it('PII 절대 비노출 — 생일·이름·이메일·출생지·gender 원본 키 없음 (showGender여도)', () => {
    const r = buildOgPayload(BASE, { layout: 'comment', showGender: true });
    const keys = Object.keys(r);
    expect(keys).not.toContain('birth_date');
    expect(keys).not.toContain('name');
    expect(keys).not.toContain('email');
    expect(keys).not.toContain('birth_place');
    expect(keys).not.toContain('gender'); // gender_normalized(정규화 M/F)만 허용 (ADR-024 옵트인)
  });

  it('동일 input → 동일 output (결정형)', () => {
    const a = buildOgPayload(BASE, { layout: 'minimal', showGender: false });
    const b = buildOgPayload(BASE, { layout: 'minimal', showGender: false });
    expect(a).toEqual(b);
  });
});

describe('deriveShareAreaScores', () => {
  it('score_breakdown 정규화 축에서 공유 영역 점수를 결정적으로 만든다', () => {
    expect(deriveShareAreaScores(78, {
      hap_chung_hyung_hae: 70,
      sipsin: 75,
      ohaeng: 68,
      yunse_adjustment: 3,
      mode_adjustment: 5,
    }, '친구합')).toEqual({
      talk: 76,
      attract: 74,
      speed: 87,
      money: 73,
      future: 74,
    });
  });

  it('가중 기여분 형태의 오래된 breakdown 도 빈 영역 막대로 만들지 않는다', () => {
    expect(deriveShareAreaScores(73, {
      hap_chung_hyung_hae: 20,
      sipsin: 18,
      ohaeng: 22,
      yunse_adjustment: 0,
      mode_adjustment: 13,
    }, '일합')).toEqual({
      talk: 58,
      attract: 64,
      speed: 80,
      money: 81,
      future: 68,
    });
  });

  it('breakdown 이 없으면 fallback 을 만들지 않는다', () => {
    expect(deriveShareAreaScores(78, null, '친구합')).toBeUndefined();
  });
});

describe('share ohaeng query helpers', () => {
  it('목화토금수 순서로 짧은 fallback 쿼리를 만든다', () => {
    expect(serializeShareOhaengCounts({ 목: 3, 화: 1, 토: 2, 금: 1, 수: 1 })).toBe('3,1,2,1,1');
  });

  it('fallback 쿼리를 오행 count 객체로 복원한다', () => {
    expect(parseShareOhaengCountsParam('3,1,2,1,1')).toEqual({ 목: 3, 화: 1, 토: 2, 금: 1, 수: 1 });
  });

  it('형식이 맞지 않으면 undefined 로 무시한다', () => {
    expect(parseShareOhaengCountsParam('3,1,2')).toBeUndefined();
    expect(parseShareOhaengCountsParam('3,foo,2,1,1')).toBeUndefined();
  });
});

describe('rangeToLayoutOptions — 레거시 range → layout/showGender 매핑 (공개 경로 하위호환)', () => {
  it('nickname-only → minimal, 성별 비표시', () => {
    expect(rangeToLayoutOptions('nickname-only')).toEqual({ layout: 'minimal', showGender: false });
  });
  it('nickname-ohaeng → ohaeng, 성별 비표시', () => {
    expect(rangeToLayoutOptions('nickname-ohaeng')).toEqual({ layout: 'ohaeng', showGender: false });
  });
  it('nickname-gender → minimal, 성별 표시', () => {
    expect(rangeToLayoutOptions('nickname-gender')).toEqual({ layout: 'minimal', showGender: true });
  });
});

describe('layoutToShareRange — layout/showGender → 레거시 range (공개 토큰 OG 하위호환)', () => {
  it('combined → DB 스키마 확장 전까지 가장 가까운 레거시 range 로 저장', () => {
    expect(layoutToShareRange('combined', false)).toBe('nickname-ohaeng');
    expect(layoutToShareRange('combined', true)).toBe('nickname-gender');
  });
  it('ohaeng → nickname-ohaeng (성별 무관)', () => {
    expect(layoutToShareRange('ohaeng', false)).toBe('nickname-ohaeng');
    expect(layoutToShareRange('ohaeng', true)).toBe('nickname-ohaeng');
  });
  it('성별 표시(오행 외) → nickname-gender', () => {
    expect(layoutToShareRange('minimal', true)).toBe('nickname-gender');
    expect(layoutToShareRange('radar', true)).toBe('nickname-gender');
    expect(layoutToShareRange('flow', true)).toBe('nickname-gender');
  });
  it('그 외 → nickname-only', () => {
    expect(layoutToShareRange('minimal', false)).toBe('nickname-only');
    expect(layoutToShareRange('radar', false)).toBe('nickname-only');
    expect(layoutToShareRange('comment', false)).toBe('nickname-only');
    expect(layoutToShareRange('flow', false)).toBe('nickname-only');
  });
});
