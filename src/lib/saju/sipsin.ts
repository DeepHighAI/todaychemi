// 십신(十神) 판별 — 일간 기준 대상 천간의 관계.
// scoring/sipsin.ts:33-52와 동일 알고리즘의 독립 재구현 (scoring 모듈 import 금지, Q6).
// ssaju 0.2.0 D 테이블과 10x10 전수 대조 테스트로 고정.

import { STEM_INFO, GENERATES, CONTROLS, type Stem, type Branch } from './ganji';
import { principalStem } from './jijanggan';

export type SipsinName =
  | '비견'
  | '겁재'
  | '식신'
  | '상관'
  | '편재'
  | '정재'
  | '편관'
  | '정관'
  | '편인'
  | '정인';

export const SIPSIN_NAMES: readonly SipsinName[] = [
  '비견',
  '겁재',
  '식신',
  '상관',
  '편재',
  '정재',
  '편관',
  '정관',
  '편인',
  '정인',
];

// 일간(dayStem) 기준 대상 천간(target)의 십신
export function sipsinOf(dayStem: Stem, target: Stem): SipsinName {
  const dayEl = STEM_INFO[dayStem].element;
  const targetEl = STEM_INFO[target].element;
  const sameYinyang = STEM_INFO[dayStem].yinyang === STEM_INFO[target].yinyang;

  if (dayEl === targetEl) {
    return sameYinyang ? '비견' : '겁재';
  }
  if (GENERATES[dayEl] === targetEl) {
    return sameYinyang ? '식신' : '상관';
  }
  if (CONTROLS[dayEl] === targetEl) {
    return sameYinyang ? '편재' : '정재';
  }
  if (CONTROLS[targetEl] === dayEl) {
    return sameYinyang ? '편관' : '정관';
  }
  // 남은 경우: target이 일간을 생 (인성)
  return sameYinyang ? '편인' : '정인';
}

// 지지 십신 = 지장간 정기 천간 기준
export function sipsinOfBranch(dayStem: Stem, branch: Branch): SipsinName {
  return sipsinOf(dayStem, principalStem(branch));
}
