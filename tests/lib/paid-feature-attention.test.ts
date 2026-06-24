// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  markPaidFeatureClickedToday,
  shouldShowPaidFeatureAttention,
} from '@/lib/paid-feature-attention';
import { todayKST } from '@/lib/today/kst-date';

vi.mock('@/lib/today/kst-date', () => ({
  todayKST: vi.fn(() => '2026-06-24'),
}));

describe('paid-feature-attention', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(todayKST).mockReturnValue('2026-06-24');
  });

  it('당일 클릭 전에는 빨간 점 대상이다', () => {
    expect(shouldShowPaidFeatureAttention('whatif')).toBe(true);
  });

  it('당일 클릭하면 같은 KST 날짜에는 빨간 점을 숨긴다', () => {
    markPaidFeatureClickedToday('hapcard');

    expect(shouldShowPaidFeatureAttention('hapcard')).toBe(false);
  });

  it('다음 KST 날짜에는 다시 빨간 점 대상이 된다', () => {
    markPaidFeatureClickedToday('replay');
    vi.mocked(todayKST).mockReturnValue('2026-06-25');

    expect(shouldShowPaidFeatureAttention('replay')).toBe(true);
  });
});
