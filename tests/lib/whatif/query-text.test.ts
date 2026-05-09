import { describe, it, expect } from 'vitest';
import { buildWhatifRagQueryText } from '@/lib/whatif/query-text';
import { MOCK_CHART_CORE, MOCK_CHART_HASH } from '../../fixtures/whatif';

const BASE_INPUT = {
  user_id: 'user-uuid-5678',
  type: 'work' as const,
  chart: MOCK_CHART_CORE,
  chart_hash: MOCK_CHART_HASH,
};

describe('buildWhatifRagQueryText', () => {
  it('결과 문자열에 diagnostic type이 포함된다', () => {
    const result = buildWhatifRagQueryText(BASE_INPUT);
    expect(result).toContain('work');
  });

  it('결과 문자열에 day_pillar가 포함된다', () => {
    const result = buildWhatifRagQueryText(BASE_INPUT);
    expect(result).toContain(MOCK_CHART_CORE.day_pillar);
  });

  it('결과 문자열에 day_master_element가 포함된다', () => {
    const result = buildWhatifRagQueryText(BASE_INPUT);
    expect(result).toContain(MOCK_CHART_CORE.day_master_element);
  });

  it('PII 가드 — user_id와 chart_hash는 포함되지 않는다', () => {
    const result = buildWhatifRagQueryText(BASE_INPUT);
    expect(result).not.toContain(BASE_INPUT.user_id);
    expect(result).not.toContain(BASE_INPUT.chart_hash);
  });
});
