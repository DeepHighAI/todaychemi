import { describe, expect, it } from 'vitest';

import { ELEMENT_FOOD_MAP, MEETING_VIBE_ARCHETYPE } from '@/lib/hapcard/element-food-map';
import type { Element5 } from '@/lib/saju/ganji';

const ALL: readonly Element5[] = ['목', '화', '토', '금', '수'];
const CJK = /[一-鿿]/u;

describe('ELEMENT_FOOD_MAP', () => {
  it('5원소 모두 비어있지 않은 음식 목록을 가진다', () => {
    for (const element of ALL) {
      expect(ELEMENT_FOOD_MAP[element].foods.length).toBeGreaterThan(0);
    }
  });

  it('고전 오행-맛 매핑이 고정되어 있다 (목=신/화=쓴/토=단/금=매운/수=짠)', () => {
    expect(ELEMENT_FOOD_MAP['목'].taste).toBe('신맛');
    expect(ELEMENT_FOOD_MAP['화'].taste).toBe('쓴맛');
    expect(ELEMENT_FOOD_MAP['토'].taste).toBe('단맛');
    expect(ELEMENT_FOOD_MAP['금'].taste).toBe('매운맛');
    expect(ELEMENT_FOOD_MAP['수'].taste).toBe('짠맛');
  });

  it('ADR-038: 음식명·맛에 한자(CJK)가 없다', () => {
    for (const element of ALL) {
      expect(ELEMENT_FOOD_MAP[element].taste).not.toMatch(CJK);
      for (const food of ELEMENT_FOOD_MAP[element].foods) {
        expect(food).not.toMatch(CJK);
      }
    }
  });
});

describe('MEETING_VIBE_ARCHETYPE', () => {
  it('5원소 모두 비어있지 않은 추상 분위기를 가진다', () => {
    for (const element of ALL) {
      expect(MEETING_VIBE_ARCHETYPE[element].length).toBeGreaterThan(0);
      expect(MEETING_VIBE_ARCHETYPE[element]).not.toMatch(CJK);
    }
  });

  it('§5: 실제 지명·상호가 아닌 추상 분위기다 (특정 장소명 없음)', () => {
    const PLACE_NAMES = ['스타벅스', '강남', '홍대', '명동', '이태원'];
    for (const element of ALL) {
      const vibe = MEETING_VIBE_ARCHETYPE[element];
      for (const place of PLACE_NAMES) {
        expect(vibe.includes(place)).toBe(false);
      }
    }
  });
});
