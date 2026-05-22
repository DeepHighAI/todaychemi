import { describe, expect, it } from 'vitest';
import { buildRoleAnalysis } from '@/lib/hapcard/role-analysis';
import { mockChartCoreSelf, mockChartCoreRelation } from '../../fixtures/hapcard';

describe('buildRoleAnalysis', () => {
  it('무신 ↔ 갑인 돈합에서 십신 기반 역할 분석을 반환한다', () => {
    const result = buildRoleAnalysis({
      self: { ...mockChartCoreSelf, day_pillar: '戊申', day_master_element: '토' },
      relation: { ...mockChartCoreRelation, day_pillar: '甲寅', day_master_element: '목' },
      mode: '돈합',
    });

    expect(result.title).toBe('무신 ↔ 갑인 관계 유지');
    expect(result.roles[0]).toMatchObject({ title: '상대가 나에게', sipsin: '편관' });
    expect(result.roles[1]).toMatchObject({ title: '내가 상대에게', sipsin: '편재' });
    expect(result.areas.map((area) => area.title)).toEqual(['수익 만들기', '분배 기준', '보관과 리스크']);
    expect(result.basis).toContain('본인 일주 무신');
    expect(result.basis).toContain('인연 일주 갑인');
  });

  it('오행 레이더가 아니라 관계 유지/기대치 중심 문장을 만든다', () => {
    const result = buildRoleAnalysis({
      self: mockChartCoreSelf,
      relation: mockChartCoreRelation,
      mode: '썸합',
    });

    expect(result.summary).toContain('역할과 기대치');
    expect(result.areas[0].body).not.toContain('목·화·토·금·수');
    expect(result.tip).toContain('속도 차이');
  });
});
