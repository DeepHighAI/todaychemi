export const HEAVENLY_STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
export const EARTHLY_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;

// 한국 표준시 기준 자오선(UTC+9 = 135°E)과 기본 출생 경도(서울).
// 출생지 미입력 시 서울 가정 — 진태양시 경도항 (126.978−135)×4 ≈ −32.1분 (ADR-021 Amended).
export const KST_STANDARD_MERIDIAN = 135;
export const DEFAULT_BIRTH_LONGITUDE = 126.978;

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

// 時支 인덱스: 분 총합(진태양시 보정 후, 음수·1440 초과 허용) → 地支 배열 인덱스.
// 경계는 홀수 정시(23,1,3,…) — 子時 = [23:00, 01:00) 이므로 +60분 시프트 후 120분 단위.
export function minutesToBranchIndex(totalMinutes: number): number {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  return Math.floor((normalized + 60) / 120) % 12;
}

// 時支 인덱스: 시각(0~23) → 地支 배열 인덱스 (보정 없는 벽시계용 — G0 도구 호환 유지)
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
