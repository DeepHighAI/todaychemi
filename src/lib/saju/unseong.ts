// 12운성(十二運星) — 봉법(양순음역): 양간은 장생 앵커에서 순행, 음간은 역행.
// ssaju 0.2.0 ce('bong') 수식 미러 — 120건 전수 대조 테스트로 고정.

import { BRANCHES, STEM_INFO, type Stem, type Branch } from './ganji';

export const STAGE12_ORDER = [
  '장생',
  '목욕',
  '관대',
  '건록',
  '제왕',
  '쇠',
  '병',
  '사',
  '묘',
  '절',
  '태',
  '양',
] as const;

export type Stage12 = (typeof STAGE12_ORDER)[number];

// 천간별 장생 지지 앵커 — ssaju me 테이블과 동일
export const JANGSAENG_ANCHOR: Record<Stem, Branch> = {
  甲: '亥',
  乙: '午',
  丙: '寅',
  丁: '酉',
  戊: '寅',
  己: '酉',
  庚: '巳',
  辛: '子',
  壬: '申',
  癸: '卯',
};

const STAGE_COUNT = 12;

export function stage12(stem: Stem, branch: Branch): Stage12 {
  const branchIdx = BRANCHES.indexOf(branch);
  const anchorIdx = BRANCHES.indexOf(JANGSAENG_ANCHOR[stem]);
  // 양간: 순행(branch − anchor), 음간: 역행(anchor − branch)
  const delta =
    STEM_INFO[stem].yinyang === '양' ? branchIdx - anchorIdx : anchorIdx - branchIdx;
  const offset = ((delta % STAGE_COUNT) + STAGE_COUNT) % STAGE_COUNT;
  return STAGE12_ORDER[offset];
}
