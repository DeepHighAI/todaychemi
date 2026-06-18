// element-food-map — 오행 → 맛 → 음식, 그리고 만남 분위기 아키타입 (energy_food 결정형 자산).
// 정적 잠금 자산. 고전 오행-맛(목=신/화=쓴/토=단/금=매운/수=짠) 기반 + 한국 친화 큐레이션.
// review_status: ai_pending_human — 명리 specialist 검수 대상(맛·식재료 적정성), ADR-040 §6.7 잠정.
// ADR-038: 모든 항목 한글(한자 0). §5: 만남 분위기는 추상 atmosphere 만 — 실제 지명·상호 금지.

import type { Element5 } from '@/lib/saju/ganji';

export interface ElementFood {
  // 고전 오행-맛
  taste: string;
  // 기운 보완 음식·식재료 (한글, 한자 0)
  foods: string[];
}

export const ELEMENT_FOOD_MAP: Record<Element5, ElementFood> = {
  목: { taste: '신맛', foods: ['매실', '레몬', '새콤한 나물무침', '딸기'] },
  화: { taste: '쓴맛', foods: ['도라지', '쌉쌀한 나물', '커피', '다크초콜릿'] },
  토: { taste: '단맛', foods: ['단호박', '고구마', '대추', '잡곡밥'] },
  금: { taste: '매운맛', foods: ['마늘', '생강', '대파', '매콤한 국물요리'] },
  수: { taste: '짠맛', foods: ['미역국', '굴', '담백한 해산물', '김'] },
};

// 만남 분위기 — 추상 atmosphere 만(특정 장소·상호 금지, §5). 첫합/썸합 전용.
export const MEETING_VIBE_ARCHETYPE: Record<Element5, string> = {
  목: '초록과 생기가 느껴지는 곳 — 식물이 보이거나 트인 분위기',
  화: '햇살 좋고 활기찬 분위기 — 밝고 따뜻한 기운이 도는 곳',
  토: '아늑하고 안정적인 분위기 — 포근하고 조용히 머물기 좋은 곳',
  금: '깔끔하고 정돈된 분위기 — 군더더기 없는 모던한 곳',
  수: '물가처럼 잔잔한 분위기 — 차분하게 흐르는 조용한 곳',
};
