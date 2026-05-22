import { describe, expect, it } from 'vitest';
import { buildOhaengInterpretation } from '@/lib/hapcard/ohaeng-interpretation';
import { mockChartCoreSelf, mockChartCoreRelation } from '../../fixtures/hapcard';

describe('buildOhaengInterpretation', () => {
  it('일주 한자를 한글로 변환한 제목과 3개 포인트를 반환한다', () => {
    const result = buildOhaengInterpretation({
      self: { ...mockChartCoreSelf, day_pillar: '戊申', day_master_element: '토' },
      relation: { ...mockChartCoreRelation, day_pillar: '甲寅', day_master_element: '목' },
      mode: '돈합',
    });

    expect(result.title).toBe('무신 ↔ 갑인 오행 해석');
    expect(result.title).not.toMatch(/[一-龥]/u);
    expect(result.points).toHaveLength(3);
  });

  it('상생 관계를 쉬운 한국어 요약으로 설명한다', () => {
    const result = buildOhaengInterpretation({
      self: { ...mockChartCoreSelf, day_master_element: '목' },
      relation: { ...mockChartCoreRelation, day_master_element: '화' },
      mode: '첫합',
    });

    expect(result.summary).toContain('본인의 목 기운이 인연의 화 기운을 살려 주는 흐름');
  });

  it('돈합 모드에서는 분배와 보관 기준을 맞추는 팁을 반환한다', () => {
    const result = buildOhaengInterpretation({
      self: mockChartCoreSelf,
      relation: mockChartCoreRelation,
      mode: '돈합',
    });

    expect(result.tip).toContain('수익 목표');
    expect(result.tip).toContain('분배 기준');
  });
});
