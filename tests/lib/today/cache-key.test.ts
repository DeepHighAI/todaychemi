import { describe, it, expect } from 'vitest';
import { buildSourcePacketHash } from '@/lib/today/cache-key';
import type { ChartCore } from '@/types/chart';

const SELF: ChartCore = {
  year_pillar: '갑자',
  month_pillar: '을축',
  day_pillar: '병인',
  hour_pillar: null,
  day_master_element: '화',
  five_elements_counts: { 목: 2, 화: 1, 토: 0, 금: 0, 수: 1 },
  gender_normalized: 'M',
  yunse: { daeun: { start_age: 7, list: [{ age: 7, pillar: '갑자', year: 1990 }], current_index: 0 }, seyun: { current_pillar: '병오', current_year: 2026 }, wolun: { current_pillar: '계사', current_month: '2026-05' }, iliun: { today_pillar: '갑자', today_date: '2026-05-07' } },
};

const REL: ChartCore = {
  year_pillar: '기묘',
  month_pillar: '경진',
  day_pillar: '신사',
  hour_pillar: null,
  day_master_element: '금',
  five_elements_counts: { 목: 1, 화: 0, 토: 1, 금: 2, 수: 1 },
  gender_normalized: 'F',
  yunse: { daeun: { start_age: 5, list: [{ age: 5, pillar: '경진', year: 1988 }], current_index: 0 }, seyun: { current_pillar: '병오', current_year: 2026 }, wolun: { current_pillar: '계사', current_month: '2026-05' }, iliun: { today_pillar: '갑자', today_date: '2026-05-07' } },
};

describe('buildSourcePacketHash (확장 시그니처)', () => {
  it('SHA-256 hex 64자', () => {
    const h = buildSourcePacketHash({
      self_chart: SELF,
      relation_chart: null,
      target_date: '2026-05-28',
      prompt_version: 'v0.3',
      model_id: 'gpt-5-mini',
    });
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it('동일 입력 = 동일 해시 (결정형)', () => {
    const args = {
      self_chart: SELF,
      relation_chart: REL,
      target_date: '2026-05-28',
      prompt_version: 'v0.3',
      model_id: 'gpt-5',
    } as const;
    expect(buildSourcePacketHash(args)).toBe(buildSourcePacketHash(args));
  });

  it('target_date 다르면 다른 해시', () => {
    const base = {
      self_chart: SELF,
      relation_chart: null,
      target_date: '2026-05-28',
      prompt_version: 'v0.3',
      model_id: 'gpt-5-mini',
    } as const;
    expect(buildSourcePacketHash(base)).not.toBe(
      buildSourcePacketHash({ ...base, target_date: '2026-05-29' }),
    );
  });

  it('self_chart 필드 다르면 다른 해시', () => {
    const base = {
      self_chart: SELF,
      relation_chart: null,
      target_date: '2026-05-28',
      prompt_version: 'v0.3',
      model_id: 'gpt-5-mini',
    } as const;
    const other: ChartCore = { ...SELF, day_master_element: '수' };
    expect(buildSourcePacketHash(base)).not.toBe(
      buildSourcePacketHash({ ...base, self_chart: other }),
    );
  });

  // G2 신규 차원 — relation_chart, prompt_version, model_id
  describe('G2 (Phase 3) 신규 차원', () => {
    const base = {
      self_chart: SELF,
      relation_chart: null,
      target_date: '2026-05-28',
      prompt_version: 'v0.3',
      model_id: 'gpt-5-mini',
    } as const;

    it('relation_chart 가 null → 동일 self → 동일 해시 (인연 없는 사용자 단독 today)', () => {
      const a = buildSourcePacketHash({ ...base, relation_chart: null });
      const b = buildSourcePacketHash({ ...base, relation_chart: null });
      expect(a).toBe(b);
    });

    it('relation_chart null vs 존재 → 다른 해시 (3축으로 전환되면 캐시 분리)', () => {
      const a = buildSourcePacketHash({ ...base, relation_chart: null });
      const b = buildSourcePacketHash({ ...base, relation_chart: REL });
      expect(a).not.toBe(b);
    });

    it('relation_chart 가 다르면 다른 해시 (인연 교체 시 캐시 분리)', () => {
      const other: ChartCore = { ...REL, day_master_element: '수' };
      const a = buildSourcePacketHash({ ...base, relation_chart: REL });
      const b = buildSourcePacketHash({ ...base, relation_chart: other });
      expect(a).not.toBe(b);
    });

    it('prompt_version 이 다르면 다른 해시 (프롬프트 변경 시 캐시 무효화)', () => {
      const a = buildSourcePacketHash({ ...base, prompt_version: 'v0.3' });
      const b = buildSourcePacketHash({ ...base, prompt_version: 'v0.4' });
      expect(a).not.toBe(b);
    });

    it('model_id 가 다르면 다른 해시 (모델 격상 시 캐시 무효화 — gpt-5-mini → gpt-5)', () => {
      const a = buildSourcePacketHash({ ...base, model_id: 'gpt-5-mini' });
      const b = buildSourcePacketHash({ ...base, model_id: 'gpt-5' });
      expect(a).not.toBe(b);
    });
  });
});
