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
// 천간 1글자 = 10 과 동일 스케일. 비율 자체(10:5:3)는 전문가 검토 대상(잠정).
export const JIJANGGAN_WEIGHTS = { 정기: 10, 중기: 5, 여기: 3 } as const;

// 지지의 정기(주기) 천간 — 십신 지지 판별의 기준 천간
export function principalStem(branch: Branch): Stem {
  return JIJANGGAN[branch].정기;
}
