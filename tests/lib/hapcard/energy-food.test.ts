import { describe, expect, it } from 'vitest';

import { ELEMENT_FOOD_MAP } from '@/lib/hapcard/element-food-map';
import {
  allowedFoodsFor,
  buildEnergyFood,
  validateEnergyFoodCopy,
} from '@/lib/hapcard/energy-food';
import type { Element5 } from '@/lib/saju/ganji';

import { mockChartCoreSelf, mockChartCoreRelation } from '../../fixtures/hapcard';

const ALL: readonly Element5[] = ['목', '화', '토', '금', '수'];
const CJK = /[一-鿿]/u;

function allStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(allStrings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(allStrings);
  return [];
}

describe('buildEnergyFood — 결정형 기운 음식', () => {
  it('공통 보완 원소 기반 음식 + 명리 근거를 반환한다 (ADR-015)', () => {
    const { energy_food } = buildEnergyFood({
      self: mockChartCoreSelf,
      relation: mockChartCoreRelation,
      mode: '일합',
    });
    expect(ALL).toContain(energy_food.element);
    expect(energy_food.foods).toEqual(ELEMENT_FOOD_MAP[energy_food.element].foods);
    expect(energy_food.reason).toContain(ELEMENT_FOOD_MAP[energy_food.element].taste);
    expect(energy_food.copy.length).toBeGreaterThan(0);
  });

  it('1000회 동일 입력 → 동일 출력 (ADR-040 결정성)', () => {
    const results = Array.from({ length: 1000 }, () =>
      JSON.stringify(
        buildEnergyFood({ self: mockChartCoreSelf, relation: mockChartCoreRelation, mode: '썸합' }),
      ),
    );
    expect(new Set(results).size).toBe(1);
  });

  it('meeting_vibe 는 첫합·썸합에서만 제공된다', () => {
    for (const mode of ['일합', '친구합', '돈합', '오래합'] as const) {
      expect(
        buildEnergyFood({ self: mockChartCoreSelf, relation: mockChartCoreRelation, mode })
          .meeting_vibe,
      ).toBeUndefined();
    }
    for (const mode of ['첫합', '썸합'] as const) {
      const { meeting_vibe } = buildEnergyFood({
        self: mockChartCoreSelf,
        relation: mockChartCoreRelation,
        mode,
      });
      expect(meeting_vibe).toBeDefined();
      expect(meeting_vibe!.archetype.length).toBeGreaterThan(0);
    }
  });

  it('ADR-038: 모든 출력 문자열에 한자(CJK)가 없다', () => {
    const built = buildEnergyFood({
      self: mockChartCoreSelf,
      relation: mockChartCoreRelation,
      mode: '첫합',
    });
    for (const s of allStrings(built)) {
      expect(s).not.toMatch(CJK);
    }
  });

  it('§5: meeting_vibe 에 실제 지명·상호가 없다', () => {
    const PLACE_NAMES = ['스타벅스', '강남', '홍대', '명동', '이태원'];
    const { meeting_vibe } = buildEnergyFood({
      self: mockChartCoreSelf,
      relation: mockChartCoreRelation,
      mode: '썸합',
    });
    const text = `${meeting_vibe!.archetype} ${meeting_vibe!.copy}`;
    for (const place of PLACE_NAMES) {
      expect(text.includes(place)).toBe(false);
    }
  });
});

describe('allowedFoodsFor — 가드용 허용 음식 목록', () => {
  it('원소별 element-food-map 음식 목록을 반환한다', () => {
    for (const element of ALL) {
      expect(allowedFoodsFor(element)).toEqual(ELEMENT_FOOD_MAP[element].foods);
    }
  });
});

describe('validateEnergyFoodCopy — LLM 윤문 가드', () => {
  it('정상 한글 문구는 통과한다', () => {
    expect(validateEnergyFoodCopy('함께 매실차 한 잔 어때요?')).toEqual({ valid: true });
  });

  it('ADR-038: 한자가 있으면 차단한다', () => {
    const result = validateEnergyFoodCopy('함께 茶 한 잔 어때요?');
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe('CONTAINS_HANJA');
  });

  it('§5: 실제 지명이 있으면 차단한다', () => {
    const result = validateEnergyFoodCopy('강남에서 매실차 한 잔 어때요?');
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe('PLACE_NAME');
  });

  it('banned-phrases(의료 단정)는 catalog 제공 시 차단한다', () => {
    const catalog = [{ category: 'health_medical', description: '', phrases: ['병이 낫는다'] }];
    const result = validateEnergyFoodCopy('이 음식을 먹으면 병이 낫는다', catalog);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe('BANNED_PHRASE');
  });
});
