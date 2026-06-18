// energy-food — 기운 음식(energy_food) + 만남 분위기(meeting_vibe) 결정형 빌더 + 폴백.
// 결정형(ADR-035/040): pair-complement 공통 보완 원소 → element-food-map. LLM 윤문이 누락/실패해도
// 이 빌더 결과로 폴백한다(ohaeng-interpretation.ts 패턴). allowedFoodsFor 는 이름 제약 가드의 출처.
// ADR-015 명리 근거 동반. ADR-038 한자 0. §5 만남 분위기는 추상 atmosphere(첫합·썸합 전용).

import { type Element5 } from '@/lib/saju/ganji';
import { pairComplementForCharts } from '@/lib/saju/pair-complement';
import type { ChartCore } from '@/types/chart';
import type { EnergyFood, MeetingVibe } from '@/types/hapcard';
import { MODE, type Mode } from '@/types/mode';

import { ELEMENT_FOOD_MAP, MEETING_VIBE_ARCHETYPE } from './element-food-map';

export interface BuildEnergyFoodInput {
  self: ChartCore;
  relation: ChartCore;
  mode: Mode;
}

export interface BuiltEnergyFood {
  energy_food: EnergyFood;
  meeting_vibe?: MeetingVibe;
}

// 가드용 허용 음식 목록 — LLM 윤문이 이 목록 밖 음식을 도입하면 차단(Phase 5).
export function allowedFoodsFor(element: Element5): string[] {
  return ELEMENT_FOOD_MAP[element].foods;
}

export function buildEnergyFood(input: BuildEnergyFoodInput): BuiltEnergyFood {
  const { element } = pairComplementForCharts(input.self, input.relation);
  const { taste, foods } = ELEMENT_FOOD_MAP[element];

  const reason = `두 사람 모두 ${element} 기운이 부족한 편이라, ${taste} 나는 음식이 균형을 채워줘요.`;
  const topFoods = foods.slice(0, 3).join(', ');
  const copy = `함께 ${topFoods} 같은 ${taste} 음식을 즐겨보면 두 사람 기운이 한결 잘 어울려요.`;
  const energy_food: EnergyFood = { element, reason, foods, copy };

  if (input.mode === MODE.CHEOTHAP || input.mode === MODE.SSEOMHAP) {
    const archetype = MEETING_VIBE_ARCHETYPE[element];
    const meeting_vibe: MeetingVibe = {
      element,
      archetype,
      copy: `${archetype}에서 만나면 두 사람 기운이 편안하게 어울려요.`,
    };
    return { energy_food, meeting_vibe };
  }

  return { energy_food };
}
