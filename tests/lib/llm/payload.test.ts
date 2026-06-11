import { describe, it, expect, vi } from 'vitest';
import { buildLlmPayload } from '@/lib/llm/payload';
import { computeCrossAnalysis } from '@/lib/saju/cross';
import { deriveSaju } from '@/lib/saju/derive';
import type { ChartCore } from '@/types/chart';
import type { Mode } from '@/types/mode';

const SELF_CHART: ChartCore = {
  year_pillar: '甲寅',
  month_pillar: '乙卯',
  day_pillar: '丙午',
  hour_pillar: '丁亥',
  day_master_element: '화',
  five_elements_counts: { 목: 3, 화: 3, 토: 1, 금: 0, 수: 1 },
  gender_normalized: 'M',
  yunse: { daeun: { start_age: 7, list: [{ age: 7, pillar: '갑자', year: 1990 }], current_index: 0 }, seyun: { current_pillar: '병오', current_year: 2026 }, wolun: { current_pillar: '계사', current_month: '2026-05' }, iliun: { today_pillar: '갑자', today_date: '2026-05-07' } },
};

const RELATION_CHART: ChartCore = {
  year_pillar: '戊申',
  month_pillar: '己酉',
  day_pillar: '庚戌',
  hour_pillar: '辛丑',
  day_master_element: '금',
  five_elements_counts: { 목: 0, 화: 0, 토: 3, 금: 4, 수: 1 },
  gender_normalized: 'F',
  yunse: { daeun: { start_age: 7, list: [{ age: 7, pillar: '갑자', year: 1990 }], current_index: 0 }, seyun: { current_pillar: '병오', current_year: 2026 }, wolun: { current_pillar: '계사', current_month: '2026-05' }, iliun: { today_pillar: '갑자', today_date: '2026-05-07' } },
};

describe('buildLlmPayload — PII 가드 + 화이트리스트', () => {
  describe('허용 키만 포함', () => {
    it('필수 키만 직렬화 (chart_core x2, mode, theory_profile.profile_version)', () => {
      const payload = buildLlmPayload({
        self: SELF_CHART,
        relation: RELATION_CHART,
        mode: '일합',
        theory_profile_version: '2026-05',
      });
      const keys = Object.keys(payload).sort();
      expect(keys).toEqual(['mode', 'relation_chart_core', 'self_chart_core', 'theory_profile']);
    });

    it('question_slot 미제공 시 키 부재', () => {
      const payload = buildLlmPayload({
        self: SELF_CHART,
        relation: RELATION_CHART,
        mode: '일합',
        theory_profile_version: '2026-05',
      });
      expect('question_slot' in payload).toBe(false);
    });

    it('question_slot 제공 시 키 존재', () => {
      const payload = buildLlmPayload({
        self: SELF_CHART,
        relation: RELATION_CHART,
        mode: '일합',
        theory_profile_version: '2026-05',
        question_slot: 'first_meeting',
      });
      expect(payload.question_slot).toBe('first_meeting');
    });

    it('target_date 제공 시 time_context.target_date 만 추가', () => {
      const payload = buildLlmPayload({
        self: SELF_CHART,
        relation: RELATION_CHART,
        mode: '일합',
        theory_profile_version: '2026-05',
        target_date: '2026-05-21',
      });
      expect(payload.time_context).toEqual({ target_date: '2026-05-21' });
      expect(JSON.stringify(payload)).not.toMatch(/birth_date/i);
    });
  });

  describe('PII 부재 (AGENTS.md §5)', () => {
    const payload = buildLlmPayload({
      self: SELF_CHART,
      relation: RELATION_CHART,
      mode: '일합',
      theory_profile_version: '2026-05',
    });
    const json = JSON.stringify(payload);

    it('birth_date 부재', () => {
      expect(json).not.toMatch(/birth_date/i);
    });

    it('nickname 부재', () => {
      expect(json).not.toMatch(/nickname/i);
    });

    it('email 부재', () => {
      expect(json).not.toMatch(/email/i);
    });

    it('birth_place 부재', () => {
      expect(json).not.toMatch(/birth_place/i);
    });

    it('DB chart_core에 런타임 extra PII 키가 섞여도 제거한다', () => {
      const selfWithPii = {
        ...SELF_CHART,
        birth_date: '1990-01-01',
        nickname: '민감한별명',
        email: 'secret@example.com',
        birth_place: 'Seoul',
        gender: 'M',
      } as unknown as ChartCore;
      const relationWithPii = {
        ...RELATION_CHART,
        birth_date: '1991-02-03',
        nickname: '상대별명',
        email: 'relation@example.com',
        birth_place: 'Busan',
        gender: 'F',
      } as unknown as ChartCore;

      const payload = buildLlmPayload({
        self: selfWithPii,
        relation: relationWithPii,
        mode: '일합',
        theory_profile_version: '2026-05',
      });
      const json = JSON.stringify(payload);

      expect(json).not.toMatch(/birth_date/i);
      expect(json).not.toMatch(/nickname/i);
      expect(json).not.toMatch(/email/i);
      expect(json).not.toMatch(/birth_place/i);
      expect(json).not.toMatch(/"gender"/);
      expect(json).not.toContain('secret@example.com');
      expect(json).not.toContain('민감한별명');
    });

    it('name 부재 (gender_normalized 의 normalized 는 허용)', () => {
      expect(json).not.toMatch(/"name"/);
    });
  });

  describe('gender 정규화 (gender_normalized 만 허용)', () => {
    it('chart_core 안 gender_normalized 보존', () => {
      const payload = buildLlmPayload({
        self: SELF_CHART,
        relation: RELATION_CHART,
        mode: '일합',
        theory_profile_version: '2026-05',
      });
      expect(payload.self_chart_core.gender_normalized).toBe('M');
      expect(payload.relation_chart_core.gender_normalized).toBe('F');
    });

    it('chart_core 외부 raw gender 키 부재', () => {
      const payload = buildLlmPayload({
        self: SELF_CHART,
        relation: RELATION_CHART,
        mode: '일합',
        theory_profile_version: '2026-05',
      });
      expect('gender' in payload).toBe(false);
    });
  });

  describe('chart_core 무손실 전달 (yunse 는 Y2 투영, derived 는 P3 압축 투영)', () => {
    it('self_chart_core 의 pillar·element·counts·gender 보존', () => {
      const payload = buildLlmPayload({
        self: SELF_CHART,
        relation: RELATION_CHART,
        mode: '일합',
        theory_profile_version: '2026-05',
      });
      const { yunse: _sy, ...restSelf } = SELF_CHART;
      const { yunse: _py, derived: _pd, ...restPayload } = payload.self_chart_core;
      expect(restPayload).toEqual(restSelf);
    });

    it('relation_chart_core 의 pillar·element·counts·gender 보존', () => {
      const payload = buildLlmPayload({
        self: SELF_CHART,
        relation: RELATION_CHART,
        mode: '일합',
        theory_profile_version: '2026-05',
      });
      const { yunse: _ry, ...restRelation } = RELATION_CHART;
      const { yunse: _py, derived: _pd, ...restPayload } = payload.relation_chart_core;
      expect(restPayload).toEqual(restRelation);
    });
  });

  describe('theory_profile 형식', () => {
    it('profile_version 만 포함', () => {
      const payload = buildLlmPayload({
        self: SELF_CHART,
        relation: RELATION_CHART,
        mode: '일합',
        theory_profile_version: '2026-05',
      });
      expect(payload.theory_profile).toEqual({ profile_version: '2026-05' });
    });

    it('ja_si_mode / longitude_correction 부재 (PII·전략값 노출 차단)', () => {
      const payload = buildLlmPayload({
        self: SELF_CHART,
        relation: RELATION_CHART,
        mode: '일합',
        theory_profile_version: '2026-05',
      });
      expect('ja_si_mode' in payload.theory_profile).toBe(false);
      expect('longitude_correction' in payload.theory_profile).toBe(false);
    });
  });

  describe('6모드 모두 전달', () => {
    const modes: Mode[] = ['일합', '친구합', '돈합', '첫합', '썸합', '오래합'];
    for (const mode of modes) {
      it(`${mode} 모드 전달`, () => {
        const payload = buildLlmPayload({
          self: SELF_CHART,
          relation: RELATION_CHART,
          mode,
          theory_profile_version: '2026-05',
        });
        expect(payload.mode).toBe(mode);
      });
    }
  });

  describe('점수 누설 차단 (ADR-035)', () => {
    it('score / compat_score 등 점수 필드 부재', () => {
      const payload = buildLlmPayload({
        self: SELF_CHART,
        relation: RELATION_CHART,
        mode: '일합',
        theory_profile_version: '2026-05',
      });
      const json = JSON.stringify(payload);
      expect(json).not.toMatch(/compat_score/);
      expect(json).not.toMatch(/"score"/);
      expect(json).not.toMatch(/score_breakdown/);
    });
  });

  describe('derived 압축 projection (P3 — LlmDerived)', () => {
    // 기둥에서 derived를 실제로 채운 ChartCore 생성 (타입 안전 — derived는 optional 필드)
    const withDerived = (chart: ChartCore): ChartCore => ({
      ...chart,
      derived: deriveSaju({
        year_pillar: chart.year_pillar,
        month_pillar: chart.month_pillar,
        day_pillar: chart.day_pillar,
        hour_pillar: chart.hour_pillar,
      }),
    });

    const EXPECTED_DERIVED_KEYS = [
      'dominant_sipsin',
      'jijanggan_elements',
      'missing_sipsin',
      'sinkang',
      'sipsin_distribution',
      'yinyang',
      'yongsin_candidates',
      'zodiac_animal',
    ];

    it('chart.derived 존재 시 압축 LlmDerived 형태로 포함 (양측)', () => {
      const payload = buildLlmPayload({
        self: withDerived(SELF_CHART),
        relation: withDerived(RELATION_CHART),
        mode: '일합',
        theory_profile_version: '2026-05',
      });
      const selfDerived = payload.self_chart_core.derived;
      const relationDerived = payload.relation_chart_core.derived;
      expect(selfDerived).toBeDefined();
      expect(relationDerived).toBeDefined();
      expect(Object.keys(selfDerived!).sort()).toEqual(EXPECTED_DERIVED_KEYS);
      expect(Object.keys(relationDerived!).sort()).toEqual(EXPECTED_DERIVED_KEYS);
      // 압축 검증 — 풀 SajuDerived 필드(8슬롯 맵·detail)는 미전달
      expect(Object.keys(selfDerived!)).not.toContain('jijanggan');
      expect(Object.keys(selfDerived!)).not.toContain('sipsin');
      expect(Object.keys(selfDerived!)).not.toContain('ilju');
    });

    it('sipsin_distribution 5그룹 + dominant ≤2 + missing 정합', () => {
      const payload = buildLlmPayload({
        self: withDerived(SELF_CHART),
        relation: withDerived(RELATION_CHART),
        mode: '일합',
        theory_profile_version: '2026-05',
      });
      const derived = payload.self_chart_core.derived!;
      expect(Object.keys(derived.sipsin_distribution).sort()).toEqual(
        ['관성', '비겁', '식상', '인성', '재성'].sort(),
      );
      expect(derived.dominant_sipsin.length).toBeLessThanOrEqual(2);
      for (const group of derived.dominant_sipsin) {
        expect(
          derived.sipsin_distribution[group as keyof typeof derived.sipsin_distribution],
        ).toBeGreaterThan(0);
      }
      for (const group of derived.missing_sipsin) {
        expect(
          derived.sipsin_distribution[group as keyof typeof derived.sipsin_distribution],
        ).toBe(0);
      }
    });

    it('sinkang 은 verdict 만 — 숫자 score 키 부재 (findScoreLeak/ADR-035 방어)', () => {
      const payload = buildLlmPayload({
        self: withDerived(SELF_CHART),
        relation: withDerived(RELATION_CHART),
        mode: '일합',
        theory_profile_version: '2026-05',
      });
      const derived = payload.self_chart_core.derived!;
      expect(Object.keys(derived.sinkang)).toEqual(['verdict']);
      expect(['신강', '중화', '신약']).toContain(derived.sinkang.verdict);
      expect(JSON.stringify(payload)).not.toMatch(/"score"/);
    });

    it('derived 부재(v2 레거시 row) → deriveSaju 폴백으로 동일 결과', () => {
      const explicit = buildLlmPayload({
        self: withDerived(SELF_CHART),
        relation: withDerived(RELATION_CHART),
        mode: '일합',
        theory_profile_version: '2026-05',
      });
      // SELF_CHART/RELATION_CHART 에는 derived 없음 → 폴백 경로
      const fallback = buildLlmPayload({
        self: SELF_CHART,
        relation: RELATION_CHART,
        mode: '일합',
        theory_profile_version: '2026-05',
      });
      expect(fallback.self_chart_core.derived).toEqual(explicit.self_chart_core.derived);
      expect(fallback.relation_chart_core.derived).toEqual(explicit.relation_chart_core.derived);
    });

    it('derived 변형(jsonb 손상) → safeParse 실패 시 생략 + [DERIVED_INVALID] warn (fail-open)', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const broken = {
        ...SELF_CHART,
        derived: { derived_version: 1 } as unknown as ChartCore['derived'],
      };
      const payload = buildLlmPayload({
        self: broken,
        relation: RELATION_CHART,
        mode: '일합',
        theory_profile_version: '2026-05',
      });
      expect(payload.self_chart_core.derived).toBeUndefined();
      // relation 측은 정상 폴백 — fail-open 이 측별로 독립
      expect(payload.relation_chart_core.derived).toBeDefined();
      expect(warnSpy).toHaveBeenCalledWith('[DERIVED_INVALID]', expect.anything());
      warnSpy.mockRestore();
    });
  });

  describe('cross_analysis 패스스루 (P3 — 결정형 교차분석)', () => {
    const CROSS = computeCrossAnalysis({
      self: SELF_CHART,
      relation: RELATION_CHART,
      mode: '일합',
      self_birth_year: 1990,
      relation_birth_year: 1996,
    });

    // openai.ts isForbiddenLlmPayloadKey 와 동일 규칙 (gender_normalized 예외 포함)
    const FORBIDDEN_KEY_RE =
      /(^|_)(birth_date|birth_time|name|nickname|email|birth_place|gender)($|_)/;
    const normalizeKey = (key: string): string =>
      key
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/[-\s]+/g, '_')
        .toLowerCase();
    const collectKeys = (value: unknown, keys: string[] = []): string[] => {
      if (value === null || typeof value !== 'object') return keys;
      if (Array.isArray(value)) {
        for (const item of value) collectKeys(item, keys);
        return keys;
      }
      for (const [key, nested] of Object.entries(value)) {
        keys.push(key);
        collectKeys(nested, keys);
      }
      return keys;
    };

    it('cross 미제공 → top-level 4키 유지', () => {
      const payload = buildLlmPayload({
        self: SELF_CHART,
        relation: RELATION_CHART,
        mode: '일합',
        theory_profile_version: '2026-05',
      });
      expect(Object.keys(payload).sort()).toEqual([
        'mode',
        'relation_chart_core',
        'self_chart_core',
        'theory_profile',
      ]);
    });

    it('cross 제공 → top-level 5키 + verbatim 패스스루', () => {
      const payload = buildLlmPayload({
        self: SELF_CHART,
        relation: RELATION_CHART,
        mode: '일합',
        theory_profile_version: '2026-05',
        cross_analysis: CROSS,
      });
      expect(Object.keys(payload).sort()).toEqual([
        'cross_analysis',
        'mode',
        'relation_chart_core',
        'self_chart_core',
        'theory_profile',
      ]);
      expect(payload.cross_analysis).toBe(CROSS);
    });

    it('cross 직렬화에 출생연도 패턴 부재 — band 문자열만 진입', () => {
      const payload = buildLlmPayload({
        self: SELF_CHART,
        relation: RELATION_CHART,
        mode: '일합',
        theory_profile_version: '2026-05',
        cross_analysis: CROSS,
      });
      const crossJson = JSON.stringify(payload.cross_analysis);
      expect(crossJson).not.toMatch(/\b(19|20)\d{2}\b/);
      expect(payload.cross_analysis?.age_gap).toEqual({ band: '4-6', relation_is: '연하' });
    });

    it('cross + derived 신규 표면에 금지 PII 키 세그먼트 0 (재귀 키 스캔)', () => {
      const payload = buildLlmPayload({
        self: SELF_CHART,
        relation: RELATION_CHART,
        mode: '일합',
        theory_profile_version: '2026-05',
        cross_analysis: CROSS,
      });
      const keys = [
        ...collectKeys(payload.cross_analysis),
        ...collectKeys(payload.self_chart_core.derived),
        ...collectKeys(payload.relation_chart_core.derived),
      ];
      expect(keys.length).toBeGreaterThan(0);
      const violations = keys.filter((key) => FORBIDDEN_KEY_RE.test(normalizeKey(key)));
      expect(violations).toEqual([]);
      // 함정 키명 직접 단언 — palace_name 금지 (palace_meaning 사용)
      expect(keys).not.toContain('palace_name');
    });
  });

  describe('Y2 yunse 투영 (spec §7 — 현재 대운 1개, 토큰 절약)', () => {
    const payload = buildLlmPayload({
      self: SELF_CHART,
      relation: RELATION_CHART,
      mode: '일합',
      theory_profile_version: '2026-05',
    });

    it('Y2: self_chart_core.yunse.daeun.current 가 payload 에 존재한다', () => {
      expect(payload.self_chart_core.yunse.daeun).toHaveProperty('current');
    });

    it('Y2: self_chart_core.yunse.daeun.list 가 payload 에 없다 (spec §7 토큰 절약)', () => {
      expect(payload.self_chart_core.yunse.daeun).not.toHaveProperty('list');
    });

    it('Y2: yunse.daeun.current = list[current_index] 의 { age, pillar, year }', () => {
      const yunse = payload.self_chart_core.yunse;
      const expected = SELF_CHART.yunse.daeun.list[SELF_CHART.yunse.daeun.current_index];
      expect(yunse.daeun.current).toEqual({ age: expected.age, pillar: expected.pillar, year: expected.year });
    });

    it('Y2: yunse.daeun.start_age 와 current_index 가 보존된다', () => {
      const yunse = payload.self_chart_core.yunse;
      expect(yunse.daeun.start_age).toBe(SELF_CHART.yunse.daeun.start_age);
      expect(yunse.daeun.current_index).toBe(SELF_CHART.yunse.daeun.current_index);
    });

    it('Y2: relation_chart_core.yunse 도 동일하게 투영된다 (list 없음, current 존재)', () => {
      expect(payload.relation_chart_core.yunse.daeun).toHaveProperty('current');
      expect(payload.relation_chart_core.yunse.daeun).not.toHaveProperty('list');
    });
  });
});
