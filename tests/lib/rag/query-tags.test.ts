import { describe, it, expect } from 'vitest';
import { buildRagQueryTags } from '@/lib/rag/query-tags';
import type { CrossAnalysis } from '@/lib/saju/cross';
import type { ChartCore } from '@/types/chart';
import type { SajuDerivedBoundary } from '@/lib/llm/payload';

const SELF: ChartCore = {
  year_pillar: '갑자',
  month_pillar: '을축',
  day_pillar: '병인',
  hour_pillar: null,
  day_master_element: '화',
  five_elements_counts: { 목: 2, 화: 1, 토: 0, 금: 0, 수: 1 },
  gender_normalized: 'M',
  yunse: {
    daeun: { start_age: 7, list: [{ age: 7, pillar: '갑자', year: 1990 }], current_index: 0 },
    seyun: { current_pillar: '병오', current_year: 2026 },
    wolun: { current_pillar: '계사', current_month: '2026-05' },
    iliun: { today_pillar: '갑자', today_date: '2026-05-07' },
  },
};

// 경계 스키마(SajuDerivedSchema) 통과 형태 — verdict/dominant 그룹을 테스트에서 제어.
// 런타임은 Zod non-strict 경계만 읽으므로 boundary 부분집합으로 충분 — ChartCore.derived
// 전체 타입(SajuDerived)으로는 의도적 캐스트 (hour_known/jijanggan/ilju 미사용)
function makeDerived(overrides: {
  level?: '신강' | '중화' | '신약';
  counts?: Partial<Record<string, number>>;
  yongsin?: { primary: '목' | '화' | '토' | '금' | '수'; secondary: ('목' | '화' | '토' | '금' | '수')[] };
}): NonNullable<ChartCore['derived']> {
  const boundary: SajuDerivedBoundary = {
    derived_version: 2,
    sipsin: {
      counts: {
        비견: 0, 겁재: 0, 식신: 0, 상관: 0, 편재: 0,
        정재: 0, 편관: 0, 정관: 0, 편인: 0, 정인: 0,
        ...overrides.counts,
      } as SajuDerivedBoundary['sipsin']['counts'],
    },
    ohaeng_weighted: { 목: 10, 화: 10, 토: 10, 금: 5, 수: 5 },
    sinkang: { level: overrides.level ?? '중화' },
    yongsin: overrides.yongsin ?? { primary: '수', secondary: ['금'] },
    yinyang_balance: { yang: 4, yin: 4 },
    tti: { animal_ko: '쥐' },
  };
  return boundary as unknown as NonNullable<ChartCore['derived']>;
}

function makeCross(overrides: Partial<CrossAnalysis> = {}): CrossAnalysis {
  const direction = {
    stems: {},
    branches_jeonggi: {},
    distribution: { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 },
    salient: [],
  };
  return {
    version: 'cross-v1',
    sipsin_cross: { self_to_relation: direction, relation_to_self: direction },
    gungwi_events: [],
    yunse_cross: [],
    ilgan_pair: {
      self_stem: '병',
      relation_stem: '신',
      self_polarity: '양',
      relation_polarity: '음',
      stem_hap: false,
    },
    ...overrides,
  } as CrossAnalysis;
}

describe('buildRagQueryTags — 기본/모드', () => {
  it('mode 태그를 항상 포함한다', () => {
    const tags = buildRagQueryTags({ mode: '일합', self: SELF }, null);
    expect(tags).toContain('일합');
  });

  it('derived·cross 모두 없으면 mode 태그만 반환', () => {
    const self = { ...SELF };
    delete (self as Partial<ChartCore>).derived;
    // derived 미저장 차트는 resolveDerivedForLlm 이 기둥에서 재계산하므로
    // 파생 base 태그는 붙는다 — mode 가 첫 태그인 것만 단언
    const tags = buildRagQueryTags({ mode: '돈합', self }, null);
    expect(tags[0]).toBe('돈합');
  });

  it('동일 input → 동일 output (결정형)', () => {
    const input = { mode: '일합' as const, self: { ...SELF, derived: makeDerived({}) } };
    const cross = makeCross();
    expect(buildRagQueryTags(input, cross)).toEqual(buildRagQueryTags(input, cross));
  });

  it('중복 태그 없이 반환한다', () => {
    const tags = buildRagQueryTags(
      { mode: '일합', self: { ...SELF, derived: makeDerived({}) } },
      makeCross({
        gungwi_events: [
          { kind: 'chung', palace: '년주', palace_meaning: '뿌리·초년', detail: 'a' },
          { kind: 'chung', palace: '월주', palace_meaning: '사회·부모', detail: 'b' },
        ],
      }),
    );
    expect(new Set(tags).size).toBe(tags.length);
  });
});

describe('buildRagQueryTags — 파생층(derived) 태그', () => {
  it('derived 존재 시 지장간 base 태그 포함 (hidden_stems, branch_inner_composition)', () => {
    const tags = buildRagQueryTags({ mode: '일합', self: { ...SELF, derived: makeDerived({}) } }, null);
    expect(tags).toContain('hidden_stems');
    expect(tags).toContain('branch_inner_composition');
  });

  it('신강 → daymaster_strength + suppress_or_support', () => {
    const tags = buildRagQueryTags(
      { mode: '일합', self: { ...SELF, derived: makeDerived({ level: '신강' }) } },
      null,
    );
    expect(tags).toContain('daymaster_strength');
    expect(tags).toContain('suppress_or_support');
  });

  it('신약 → weak_daymaster_balance 추가', () => {
    const tags = buildRagQueryTags(
      { mode: '일합', self: { ...SELF, derived: makeDerived({ level: '신약' }) } },
      null,
    );
    expect(tags).toContain('weak_daymaster_balance');
    expect(tags).toContain('daymaster_strength');
  });

  it('중화 → moderation_ideal/balance_harmony/strength_balance', () => {
    const tags = buildRagQueryTags(
      { mode: '일합', self: { ...SELF, derived: makeDerived({ level: '중화' }) } },
      null,
    );
    expect(tags).toContain('moderation_ideal');
    expect(tags).toContain('balance_harmony');
    expect(tags).toContain('strength_balance');
  });

  it('dominant 비겁 → peer_support 계열 태그', () => {
    const tags = buildRagQueryTags(
      { mode: '친구합', self: { ...SELF, derived: makeDerived({ counts: { 비견: 3, 겁재: 2 } }) } },
      null,
    );
    expect(tags).toContain('peer_support');
    expect(tags).toContain('peer_rivalry');
  });

  it('dominant 재성 → wealth 계열 태그', () => {
    const tags = buildRagQueryTags(
      { mode: '돈합', self: { ...SELF, derived: makeDerived({ counts: { 편재: 3, 정재: 2 } }) } },
      null,
    );
    expect(tags).toContain('wealth_activation');
    expect(tags).toContain('creative_wealth');
  });

  it('용신 후보 존재 → useful_god', () => {
    const tags = buildRagQueryTags(
      { mode: '일합', self: { ...SELF, derived: makeDerived({}) } },
      null,
    );
    expect(tags).toContain('useful_god');
  });

  it('변형 derived → throw 없이 self-heal (resolveDerivedForLlm 경유)', () => {
    const malformed = { derived_version: 99 } as unknown as NonNullable<ChartCore['derived']>;
    expect(() =>
      buildRagQueryTags({ mode: '일합', self: { ...SELF, derived: malformed } }, null),
    ).not.toThrow();
  });
});

describe('buildRagQueryTags — 교차분석(cross) 태그', () => {
  it('gungwi_events 존재 → palace_positions + four_pillars_roles', () => {
    const cross = makeCross({
      gungwi_events: [{ kind: 'branch_hap', palace: '년주', palace_meaning: '뿌리·초년', detail: 'x' }],
    });
    const tags = buildRagQueryTags({ mode: '일합', self: SELF }, cross);
    expect(tags).toContain('palace_positions');
    expect(tags).toContain('four_pillars_roles');
  });

  it('일주 궁위 이벤트 + 썸합 → spouse_palace', () => {
    const cross = makeCross({
      gungwi_events: [{ kind: 'branch_hap', palace: '일주', palace_meaning: '배우자궁·자아', detail: 'x' }],
    });
    const tags = buildRagQueryTags({ mode: '썸합', self: SELF }, cross);
    expect(tags).toContain('spouse_palace');
  });

  it('일주 궁위 이벤트라도 일합이면 spouse_palace 미포함', () => {
    const cross = makeCross({
      gungwi_events: [{ kind: 'branch_hap', palace: '일주', palace_meaning: '배우자궁·자아', detail: 'x' }],
    });
    const tags = buildRagQueryTags({ mode: '일합', self: SELF }, cross);
    expect(tags).not.toContain('spouse_palace');
  });

  it('chung 이벤트 → six_clash/separation_tendency/unresolved_conflict', () => {
    const cross = makeCross({
      gungwi_events: [{ kind: 'chung', palace: '년주', palace_meaning: '뿌리·초년', detail: 'x' }],
    });
    const tags = buildRagQueryTags({ mode: '일합', self: SELF }, cross);
    expect(tags).toContain('six_clash');
    expect(tags).toContain('separation_tendency');
    expect(tags).toContain('unresolved_conflict');
  });

  it('samhap_half 이벤트 → triple_harmony/combined_strength/synergy_energy', () => {
    const cross = makeCross({
      gungwi_events: [{ kind: 'samhap_half', palace: null, palace_meaning: null, detail: 'x' }],
    });
    const tags = buildRagQueryTags({ mode: '썸합', self: SELF }, cross);
    expect(tags).toContain('triple_harmony');
    expect(tags).toContain('combined_strength');
    expect(tags).toContain('synergy_energy');
  });

  it('yunse_cross chung → six_clash 계열 태그', () => {
    const cross = makeCross({
      yunse_cross: [{ layer: 'daeun', direction: 'self_to_relation', kind: 'chung', detail: 'x' }],
    });
    const tags = buildRagQueryTags({ mode: '오래합', self: SELF }, cross);
    expect(tags).toContain('six_clash');
  });

  it('cross null → cross 태그 없음 (palace_positions 미포함)', () => {
    const tags = buildRagQueryTags({ mode: '일합', self: SELF }, null);
    expect(tags).not.toContain('palace_positions');
  });
});
