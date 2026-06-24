import { describe, expect, it } from 'vitest';

import { findForbiddenAdMarkers } from './assert-no-test-ad-id';

describe('findForbiddenAdMarkers', () => {
  it('배너 테스트 광고 ID 를 검출한다', () => {
    expect(findForbiddenAdMarkers('const x="ait-ad-test-banner-id";')).toContain('ait-ad-test');
  });

  it('리워드 테스트 광고 ID 를 검출한다', () => {
    expect(findForbiddenAdMarkers('showFullScreenAd({adGroupId:"ait-ad-test-rewarded-id"})')).toContain(
      'ait-ad-test',
    );
  });

  it('전면형/피드형 테스트 광고 ID 도 검출한다', () => {
    expect(findForbiddenAdMarkers('"ait-ad-test-interstitial-id"')).toHaveLength(1);
    expect(findForbiddenAdMarkers('"ait-ad-test-native-image-id"')).toHaveLength(1);
  });

  it('운영 라이브 광고 ID(ait.v2.live.*)는 통과한다', () => {
    expect(findForbiddenAdMarkers('const x="ait.v2.live.a36156fd5d3c461d";')).toHaveLength(0);
    expect(findForbiddenAdMarkers('const y="ait.v2.live.234c1a1d08ee4ce3";')).toHaveLength(0);
  });

  it('테스트 ID 가 없는 일반 코드는 통과한다', () => {
    expect(findForbiddenAdMarkers('export const a = 1; // no ad ids here')).toHaveLength(0);
  });
});
