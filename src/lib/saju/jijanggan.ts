// 지장간(支藏干) 테이블 — ssaju 0.2.0 k 테이블과 동일 내용 (대조 테스트로 고정).
// 지지 속에 숨은 천간: 여기(餘氣)·중기(中氣)·정기(正氣).

import type { Stem, Branch } from './ganji';

export interface JijangganEntry {
  여기: Stem | null;
  중기: Stem | null;
  정기: Stem;
}

export const JIJANGGAN: Record<Branch, JijangganEntry> = {
  子: { 여기: null, 중기: null, 정기: '癸' },
  丑: { 여기: '癸', 중기: '辛', 정기: '己' },
  寅: { 여기: '戊', 중기: '丙', 정기: '甲' },
  卯: { 여기: null, 중기: null, 정기: '乙' },
  辰: { 여기: '乙', 중기: '癸', 정기: '戊' },
  巳: { 여기: '戊', 중기: '庚', 정기: '丙' },
  午: { 여기: null, 중기: '己', 정기: '丁' },
  未: { 여기: '丁', 중기: '乙', 정기: '己' },
  申: { 여기: '戊', 중기: '壬', 정기: '庚' },
  酉: { 여기: null, 중기: null, 정기: '辛' },
  戌: { 여기: '辛', 중기: '丁', 정기: '戊' },
  亥: { 여기: null, 중기: '甲', 정기: '壬' },
};

// 가중치 — 정수 ×10 스케일 (부동소수 0.3+0.5 비결정성 회피, ADR-035).
// 천간 1글자 = 10 과 동일 스케일. 기본 서열 = 정기 > 중기 > 여기.
export const JIJANGGAN_WEIGHTS = { 정기: 10, 중기: 5, 여기: 3 } as const;

// 사계월(四庫月) — 辰戌丑未. 고전 사령 일수(三命通會 論人元司事: 여기 7일 > 중기[묘고] 5일)
// 기준으로 중기/여기 서열이 기본과 반대다.
export const FOUR_STORAGE_BRANCHES: ReadonlySet<Branch> = new Set(['辰', '戌', '丑', '未']);

// R1 (derived_version 2, 2026-06-12 RAG 검수 — 사용자 확정): 지지별 가중.
// 사계월만 중기/여기 교환 — 3슬롯이 항상 채워져 있어 교환이 오행 총합을 보존한다 (테스트 잠금).
export function jijangganWeightsFor(branch: Branch): { 정기: number; 중기: number; 여기: number } {
  return FOUR_STORAGE_BRANCHES.has(branch)
    ? { 정기: 10, 중기: 3, 여기: 5 }
    : JIJANGGAN_WEIGHTS;
}

// 지지의 정기(주기) 천간 — 십신 지지 판별의 기준 천간
export function principalStem(branch: Branch): Stem {
  return JIJANGGAN[branch].정기;
}
