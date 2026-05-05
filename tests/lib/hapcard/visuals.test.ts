import { describe, it, expect } from 'vitest';
import { deriveVisuals } from '@/lib/hapcard/visuals';
import { mockChartCoreSelf, mockChartCoreRelation } from '../../fixtures/hapcard';

describe('deriveVisuals', () => {
  it('user 슬라이스 — day_pillar, day_master_element, five_elements_counts', () => {
    const v = deriveVisuals(mockChartCoreSelf, mockChartCoreRelation);
    expect(v.user.day_pillar).toBe(mockChartCoreSelf.day_pillar);
    expect(v.user.day_master_element).toBe(mockChartCoreSelf.day_master_element);
    expect(v.user.five_elements_counts).toEqual(mockChartCoreSelf.five_elements_counts);
  });

  it('relation 슬라이스 — day_pillar, day_master_element, five_elements_counts', () => {
    const v = deriveVisuals(mockChartCoreSelf, mockChartCoreRelation);
    expect(v.relation.day_pillar).toBe(mockChartCoreRelation.day_pillar);
    expect(v.relation.day_master_element).toBe(mockChartCoreRelation.day_master_element);
    expect(v.relation.five_elements_counts).toEqual(mockChartCoreRelation.five_elements_counts);
  });

  it('user와 relation은 독립된 객체', () => {
    const v = deriveVisuals(mockChartCoreSelf, mockChartCoreRelation);
    expect(v.user).not.toBe(v.relation);
  });
});
