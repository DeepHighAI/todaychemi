export const HEAVENLY_STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
export const EARTHLY_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;

export type Element = '목' | '화' | '토' | '금' | '수';

export const STEM_ELEMENT: Record<string, Element> = {
  '甲': '목', '乙': '목',
  '丙': '화', '丁': '화',
  '戊': '토', '己': '토',
  '庚': '금', '辛': '금',
  '壬': '수', '癸': '수',
};

export const BRANCH_ELEMENT: Record<string, Element> = {
  '子': '수', '丑': '토',
  '寅': '목', '卯': '목',
  '辰': '토', '巳': '화',
  '午': '화', '未': '토',
  '申': '금', '酉': '금',
  '戌': '토', '亥': '수',
};

// 時支 인덱스: 시각(0~23) → 地支 배열 인덱스
export function hourToBranchIndex(hour: number): number {
  if (hour >= 23 || hour < 1) return 0;   // 子
  if (hour < 3) return 1;                  // 丑
  if (hour < 5) return 2;                  // 寅
  if (hour < 7) return 3;                  // 卯
  if (hour < 9) return 4;                  // 辰
  if (hour < 11) return 5;                 // 巳
  if (hour < 13) return 6;                 // 午
  if (hour < 15) return 7;                 // 未
  if (hour < 17) return 8;                 // 申
  if (hour < 19) return 9;                 // 酉
  if (hour < 21) return 10;               // 戌
  return 11;                               // 亥 (21~23)
}

// 일간(日干) → 子時 천간 인덱스 (五虎遁年起法 유추 - 時柱 기본 공식)
// 甲己일 → 子時 = 甲(0), 乙庚일 → 丙(2), 丙辛일 → 戊(4), 丁壬일 → 庚(6), 戊癸일 → 壬(8)
export const HOUR_STEM_BASE: Record<string, number> = {
  '甲': 0, '己': 0,
  '乙': 2, '庚': 2,
  '丙': 4, '辛': 4,
  '丁': 6, '壬': 6,
  '戊': 8, '癸': 8,
};
