import { describe, expect, it } from 'vitest';

import { findLiveAdIdBuildFailure, findMissingLiveAdId } from './assert-live-ad-id';

describe('findMissingLiveAdId', () => {
  it('기대 광고 ID 가 번들 코드에 인라인되어 있으면 null (정상)', () => {
    const code = 'const a="ait.v2.live.a36156fd5d3c461d";export const x=1;';
    expect(findMissingLiveAdId(code, 'ait.v2.live.a36156fd5d3c461d')).toBeNull();
  });

  it('기대 광고 ID 가 번들에 없으면 그 ID 를 반환한다(미인라인 → 빌드 실패 유도)', () => {
    const code = 'export const x=1; // no ad id inlined';
    expect(findMissingLiveAdId(code, 'ait.v2.live.a36156fd5d3c461d')).toBe(
      'ait.v2.live.a36156fd5d3c461d',
    );
  });

  it('기대 ID 가 비어있으면(dev/미설정 빌드) null — 강제하지 않는다', () => {
    expect(findMissingLiveAdId('anything', '')).toBeNull();
    expect(findMissingLiveAdId('anything', undefined)).toBeNull();
    expect(findMissingLiveAdId('anything', '   ')).toBeNull();
  });

  it('기대 ID 앞뒤 공백은 무시하고 비교한다', () => {
    const code = 'x="ait.v2.live.abc"';
    expect(findMissingLiveAdId(code, '  ait.v2.live.abc  ')).toBeNull();
  });
});

describe('findLiveAdIdBuildFailure', () => {
  it('프로덕션 빌드 가드에서는 기대 ID 공란을 env 누락으로 실패 처리한다', () => {
    expect(findLiveAdIdBuildFailure('anything', '')).toContain('VITE_TOSS_AD_GROUP_ID');
    expect(findLiveAdIdBuildFailure('anything', undefined)).toContain(
      'VITE_TOSS_AD_GROUP_ID',
    );
    expect(findLiveAdIdBuildFailure('anything', '   ')).toContain('VITE_TOSS_AD_GROUP_ID');
  });

  it('기대 광고 ID 가 번들에 없으면 빌드 실패 메시지를 반환한다', () => {
    expect(findLiveAdIdBuildFailure('export const x=1;', 'ait.v2.live.a36156fd5d3c461d')).toContain(
      'ait.v2.live.a36156fd5d3c461d',
    );
  });

  it('기대 광고 ID 가 번들에 있으면 null (정상)', () => {
    expect(
      findLiveAdIdBuildFailure(
        'const a="ait.v2.live.a36156fd5d3c461d";',
        'ait.v2.live.a36156fd5d3c461d',
      ),
    ).toBeNull();
  });
});
