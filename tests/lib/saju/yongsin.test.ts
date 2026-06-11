import { describe, it, expect } from 'vitest';

import { computeYongsin } from '@/lib/saju/yongsin';
import type { Element5 } from '@/lib/saju/ganji';

function weights(partial: Partial<Record<Element5, number>>): Record<Element5, number> {
  return { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0, ...partial };
}

describe('computeYongsin — 억부 1차 룰', () => {
  it('신약: primary=인성(고정), secondary=[비겁], huisin=인성을 생하는 오행', () => {
    // 甲(목) 신약 → 인성=수, 비겁=목, 희신=GENERATED_BY[수]=금
    const result = computeYongsin('甲', '신약', weights({ 목: 10, 금: 30 }));
    expect(result).toEqual({
      basis: '억부신약',
      primary: '수',
      secondary: ['목'],
      huisin: '금',
    });
  });

  it('신약: weighted 값과 무관하게 인성 고정', () => {
    // 庚(금) 신약 → 인성=토, 비겁=금, 희신=화
    const result = computeYongsin('庚', '신약', weights({ 토: 0, 화: 99 }));
    expect(result).toEqual({
      basis: '억부신약',
      primary: '토',
      secondary: ['금'],
      huisin: '화',
    });
  });

  it('신강: primary=관성/식상/재성 중 weighted 최대', () => {
    // 甲(목) 신강 → 후보 관성=금, 식상=화, 재성=토. 토가 최대 → primary 토(재성)
    const result = computeYongsin('甲', '신강', weights({ 목: 30, 화: 5, 토: 20, 금: 10, 수: 8 }));
    expect(result.basis).toBe('억부신강');
    expect(result.primary).toBe('토');
    // secondary = 나머지 2개, 고정 우선순위(관성>식상>재성) 순서 유지
    expect(result.secondary).toEqual(['금', '화']);
    expect(result.huisin).toBe('화'); // GENERATED_BY[토]=화
  });

  it('신강 동률: 고정 우선순위 관성 > 식상 > 재성', () => {
    // 甲(목): 관성=금 10, 식상=화 10 동률 → 관성(금) 우선
    const tie2 = computeYongsin('甲', '신강', weights({ 금: 10, 화: 10, 토: 5 }));
    expect(tie2.primary).toBe('금');
    expect(tie2.secondary).toEqual(['화', '토']);
    expect(tie2.huisin).toBe('토'); // GENERATED_BY[금]=토

    // 3개 전부 동률 → 관성(금)
    const tie3 = computeYongsin('甲', '신강', weights({ 금: 7, 화: 7, 토: 7 }));
    expect(tie3.primary).toBe('금');

    // 식상=화, 재성=토 동률(관성 열세) → 식상(화)
    const tieSik = computeYongsin('甲', '신강', weights({ 금: 1, 화: 9, 토: 9 }));
    expect(tieSik.primary).toBe('화');
    expect(tieSik.secondary).toEqual(['금', '토']);
  });

  it('신강: 일간이 다른 천간에서도 후보 매핑 정확', () => {
    // 壬(수) 신강 → 관성=토, 식상=목, 재성=화. 목 최대 → primary 목(식상)
    const result = computeYongsin('壬', '신강', weights({ 토: 5, 목: 20, 화: 10 }));
    expect(result.primary).toBe('목');
    expect(result.secondary).toEqual(['토', '화']);
    expect(result.huisin).toBe('수'); // GENERATED_BY[목]=수
  });

  it('중화: weighted 최소 오행 보완, secondary 없음', () => {
    const result = computeYongsin('甲', '중화', weights({ 목: 30, 화: 5, 토: 20, 금: 10, 수: 8 }));
    expect(result).toEqual({
      basis: '중화보완',
      primary: '화',
      secondary: [],
      huisin: '목', // GENERATED_BY[화]=목
    });
  });

  it('중화 동률: 목화토금수 고정 순서로 tie-break', () => {
    // 화·토 동률 최소 → 화 (목화토금수 순)
    const tieMid = computeYongsin('甲', '중화', weights({ 목: 10, 화: 5, 토: 5, 금: 20, 수: 7 }));
    expect(tieMid.primary).toBe('화');

    // 목 포함 동률 → 목
    const tieWood = computeYongsin('甲', '중화', weights({ 목: 5, 화: 5, 토: 9, 금: 9, 수: 9 }));
    expect(tieWood.primary).toBe('목');

    // 전부 0 동률 → 목
    const allZero = computeYongsin('丙', '중화', weights({}));
    expect(allZero.primary).toBe('목');
    expect(allZero.huisin).toBe('수');
  });

  it('is deterministic for identical input', () => {
    const w = weights({ 목: 12, 화: 12, 토: 12, 금: 12, 수: 12 });
    const first = computeYongsin('戊', '신강', w);
    for (let i = 0; i < 100; i += 1) {
      expect(computeYongsin('戊', '신강', w)).toEqual(first);
    }
  });
});
