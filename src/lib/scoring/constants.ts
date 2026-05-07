import type { Mode } from '@/types/mode';

export const SCORING_VERSION = 1;

// ADR-036: |change_score| ≥ 이 값이면 '흐름 변화 큼' badge + 합피드 상단 정렬
export const CHANGE_SCORE_THRESHOLD = 10;

// §2.1 천간합 — 일간 순서 기준 정규화 키 → 점수
export const STEM_HAP: Record<string, number> = {
  '甲己': 12, '乙庚': 12, '丙辛': 12, '丁壬': 12, '戊癸': 12,
};

// §2.2 지지합 — 지지 순서 기준 정규화 키 → 점수
export const BRANCH_HAP: Record<string, number> = {
  '子丑': 10, '寅亥': 10, '卯戌': 10, '辰酉': 10, '巳申': 10, '午未': 10,
};

// §2.3 삼합·반합
export const SAMHAP: ReadonlyArray<{
  readonly full: readonly [string, string, string];
  readonly fullScore: number;
  readonly halfScore: number;
}> = [
  { full: ['寅', '午', '戌'], fullScore: 15, halfScore: 8 },
  { full: ['申', '子', '辰'], fullScore: 15, halfScore: 8 },
  { full: ['巳', '酉', '丑'], fullScore: 15, halfScore: 8 },
  { full: ['亥', '卯', '未'], fullScore: 15, halfScore: 8 },
];

// §2.4 충 — 지지 순서 기준 정규화 키 → 점수
export const CHUNG: Record<string, number> = {
  '子午': -15, '丑未': -15, '寅申': -15, '卯酉': -15, '辰戌': -15, '巳亥': -15,
};

// §2.4 형 — 삼형 그룹 + 자형 집합
export const HYUNG_TRIPLES: ReadonlyArray<readonly [string, string, string]> = [
  ['寅', '巳', '申'],
  ['丑', '戌', '未'],
];
export const HYUNG_SELF: ReadonlySet<string> = new Set(['子', '午', '酉', '辰']);
export const HYUNG_SCORE = -10;

// §2.4 파 — 지지 순서 기준 정규화 키 → 점수
export const PA: Record<string, number> = {
  '子酉': -5, '卯午': -5, '寅亥': -5, '巳申': -5, '丑辰': -5, '未戌': -5,
};

// §2.4 해 — 지지 순서 기준 정규화 키 → 점수
export const HAE: Record<string, number> = {
  '子未': -5, '丑午': -5, '寅巳': -5, '卯辰': -5, '申亥': -5, '酉戌': -5,
};

// §3.1 십신 축 매핑
export interface SipsinAxes {
  authority: number;  // 권위 (직장)
  execution: number;  // 실행 (비즈니스)
  emotion: number;    // 정서 (친구·연애)
  assets: number;     // 자산 (재물)
}

export const SIPSIN_AXIS: Record<string, SipsinAxes> = {
  '정관': { authority: 12, execution: 5,  emotion: 3,   assets: 5  },
  '편관': { authority: 8,  execution: 10, emotion: -3,  assets: 3  },
  '식신': { authority: 5,  execution: 8,  emotion: 10,  assets: 5  },
  '상관': { authority: 3,  execution: 10, emotion: 5,   assets: 3  },
  '정재': { authority: 5,  execution: 8,  emotion: 5,   assets: 12 },
  '편재': { authority: 3,  execution: 10, emotion: 3,   assets: 10 },
  '정인': { authority: 8,  execution: 5,  emotion: 10,  assets: 5  },
  '편인': { authority: 5,  execution: 5,  emotion: 5,   assets: 5  },
  '비견': { authority: 3,  execution: 5,  emotion: 8,   assets: 3  },
  '겁재': { authority: -3, execution: 3,  emotion: 3,   assets: -3 },
};

// §6 6모드별 가중치 (합계 = 1.0)
export const MODE_WEIGHTS: Record<Mode, { hap: number; sipsin: number; ohaeng: number }> = {
  '일합':   { hap: 0.35, sipsin: 0.40, ohaeng: 0.25 },
  '친구합': { hap: 0.45, sipsin: 0.25, ohaeng: 0.30 },
  '돈합':   { hap: 0.35, sipsin: 0.35, ohaeng: 0.30 },
  '첫합':   { hap: 0.50, sipsin: 0.20, ohaeng: 0.30 },
  '썸합':   { hap: 0.45, sipsin: 0.25, ohaeng: 0.30 },
  '오래합': { hap: 0.40, sipsin: 0.25, ohaeng: 0.35 },
};
