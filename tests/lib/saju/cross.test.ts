import { describe, it, expect } from 'vitest';

import {
  CROSS_ANALYSIS_VERSION,
  PALACE_MEANINGS,
  computeSipsinCross,
  computeGungwiEvents,
} from '@/lib/saju/cross';
import type { ChartCore, YunseCore } from '@/types/chart';

// ---------------------------------------------------------------------------
// 공통 픽스처 — '조용한' yunse: 己巳는 丙午/庚戌/辛丑 일주와 합·충 0건이 되도록 선정
// (확장 시 충돌 여부 재검증 필요)
// ---------------------------------------------------------------------------
const QUIET_YUNSE: YunseCore = {
  daeun: { start_age: 7, list: [{ age: 7, pillar: '己巳', year: 1990 }], current_index: 0 },
  seyun: { current_pillar: '己巳', current_year: 2026 },
  wolun: { current_pillar: '己巳', current_month: '2026-06' },
  iliun: { today_pillar: '己巳', today_date: '2026-06-11' },
};

interface PillarsInput {
  year: string;
  month: string | null;
  day: string;
  hour: string | null;
}

function makeChart(pillars: PillarsInput, yunse: YunseCore = QUIET_YUNSE): ChartCore {
  return {
    year_pillar: pillars.year,
    month_pillar: pillars.month,
    day_pillar: pillars.day,
    hour_pillar: pillars.hour,
    // cross 모듈 미사용 필드 — 고정 더미값
    day_master_element: '화',
    five_elements_counts: { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 },
    gender_normalized: 'M',
    yunse,
  };
}

// 정답표 기준 쌍 — SELF 일간 丙(화·양), RELATION 일간 庚(금·양)
const SELF = makeChart({ year: '甲寅', month: '乙卯', day: '丙午', hour: '丁亥' });
const RELATION = makeChart({ year: '戊申', month: '己酉', day: '庚戌', hour: '辛丑' });

describe('cross — 상수', () => {
  it('CROSS_ANALYSIS_VERSION = cross-v1', () => {
    expect(CROSS_ANALYSIS_VERSION).toBe('cross-v1');
  });

  it('PALACE_MEANINGS: 4궁위 고정 의미', () => {
    expect(PALACE_MEANINGS).toEqual({
      년주: '뿌리·초년',
      월주: '사회·부모',
      일주: '배우자궁·자아',
      시주: '미래·자식',
    });
  });
});

describe('computeSipsinCross — 양방향 십신 교차 매트릭스', () => {
  it('self_to_relation: 상대 4천간 + 4지지(정기)를 내 일간(丙) 기준으로 판별', () => {
    const cross = computeSipsinCross(SELF, RELATION);
    expect(cross.self_to_relation.stems).toEqual({
      year: '식신', // 戊(토·양)
      month: '상관', // 己(토·음)
      day: '편재', // 庚(금·양) — 상대 일간도 일반 타깃
      hour: '정재', // 辛(금·음)
    });
    expect(cross.self_to_relation.branches_jeonggi).toEqual({
      year: '편재', // 申 정기 庚
      month: '정재', // 酉 정기 辛
      day: '식신', // 戌 정기 戊
      hour: '상관', // 丑 정기 己
    });
  });

  it('relation_to_self: 내 4천간 + 4지지(정기)를 상대 일간(庚) 기준으로 판별', () => {
    const cross = computeSipsinCross(SELF, RELATION);
    expect(cross.relation_to_self.stems).toEqual({
      year: '편재', // 甲(목·양)
      month: '정재', // 乙(목·음)
      day: '편관', // 丙(화·양)
      hour: '정관', // 丁(화·음)
    });
    expect(cross.relation_to_self.branches_jeonggi).toEqual({
      year: '편재', // 寅 정기 甲
      month: '정재', // 卯 정기 乙
      day: '정관', // 午 정기 丁
      hour: '식신', // 亥 정기 壬
    });
  });

  it('distribution: 8슬롯 5그룹 집계 — 5키 전부 존재(0 포함)', () => {
    const cross = computeSipsinCross(SELF, RELATION);
    expect(cross.self_to_relation.distribution).toEqual({
      비겁: 0,
      식상: 4,
      재성: 4,
      관성: 0,
      인성: 0,
    });
    expect(cross.relation_to_self.distribution).toEqual({
      비겁: 0,
      식상: 1,
      재성: 4,
      관성: 3,
      인성: 0,
    });
  });

  it('salient: 선정 규칙 ①일간 슬롯 ②최다 그룹(>=3, 동률은 비겁→식상→재성→관성→인성 순) ③재성+관성>=4', () => {
    const cross = computeSipsinCross(SELF, RELATION);
    // s2r: 식상 4 / 재성 4 동률 → 고정 순서상 식상 선택
    expect(cross.self_to_relation.salient).toEqual([
      '상대 일간(庚) = 내 일간 기준 편재(재성)',
      '내 일간 기준 상대 사주에 식상 기운이 4곳',
      '내 일간 기준 상대 사주에 재성·관성이 합 4곳으로 집중',
    ]);
    expect(cross.relation_to_self.salient).toEqual([
      '내 일간(丙) = 상대 일간 기준 편관(관성)',
      '상대 일간 기준 내 사주에 재성 기운이 4곳',
      '상대 일간 기준 내 사주에 재성·관성이 합 7곳으로 집중',
    ]);
  });

  it('salient는 최대 3문장', () => {
    const cross = computeSipsinCross(SELF, RELATION);
    expect(cross.self_to_relation.salient.length).toBeLessThanOrEqual(3);
    expect(cross.relation_to_self.salient.length).toBeLessThanOrEqual(3);
  });

  it('hour_pillar null: 해당 슬롯 자동 스킵 — 6슬롯 집계 + 조건부 salient 감소', () => {
    const relationNoHour = makeChart({ year: '戊申', month: '己酉', day: '庚戌', hour: null });
    const cross = computeSipsinCross(SELF, relationNoHour);
    expect(cross.self_to_relation.stems).toEqual({ year: '식신', month: '상관', day: '편재' });
    expect(cross.self_to_relation.branches_jeonggi).toEqual({
      year: '편재',
      month: '정재',
      day: '식신',
    });
    expect(cross.self_to_relation.distribution).toEqual({
      비겁: 0,
      식상: 3,
      재성: 3,
      관성: 0,
      인성: 0,
    });
    // ③ 재성+관성 = 3 < 4 → 집중 문장 미발화
    expect(cross.self_to_relation.salient).toEqual([
      '상대 일간(庚) = 내 일간 기준 편재(재성)',
      '내 일간 기준 상대 사주에 식상 기운이 3곳',
    ]);
  });

  it('한글 독음 기둥 입력도 한자 입력과 동일 결과 (normalizeGanji 인코딩 면역)', () => {
    const selfKo = makeChart({ year: '갑인', month: '을묘', day: '병오', hour: '정해' });
    const relationKo = makeChart({ year: '무신', month: '기유', day: '경술', hour: '신축' });
    expect(computeSipsinCross(selfKo, relationKo)).toEqual(computeSipsinCross(SELF, RELATION));
  });
});

describe('computeGungwiEvents — 합·충 이벤트 궁위 귀속', () => {
  it('pillarIndex 보유 이벤트(충)는 궁위 + 의미 라벨, 삼합은 palace null', () => {
    // SELF×RELATION: 寅申 충(년), 卯酉 충(월), 寅午戌 삼합 완성(궁위 미상)
    expect(computeGungwiEvents(SELF, RELATION)).toEqual([
      {
        kind: 'chung',
        palace: '년주',
        palace_meaning: '뿌리·초년',
        detail: '내 년지 寅 ↔ 상대 년지 申 충',
      },
      {
        kind: 'chung',
        palace: '월주',
        palace_meaning: '사회·부모',
        detail: '내 월지 卯 ↔ 상대 월지 酉 충',
      },
      {
        kind: 'samhap_full',
        palace: null,
        palace_meaning: null,
        detail: '양측 지지에 寅·午·戌 삼합 완성',
      },
    ]);
  });

  it('동일 궁위 내 kind 사전순 정렬 — 寅亥는 지지합+파 동시 발생', () => {
    const selfS = makeChart({ year: '甲寅', month: null, day: '丙午', hour: null });
    const relS = makeChart({ year: '乙亥', month: null, day: '庚戌', hour: null });
    expect(computeGungwiEvents(selfS, relS)).toEqual([
      {
        kind: 'branch_hap',
        palace: '년주',
        palace_meaning: '뿌리·초년',
        detail: '내 년지 寅 ↔ 상대 년지 亥 지지합',
      },
      {
        kind: 'pa',
        palace: '년주',
        palace_meaning: '뿌리·초년',
        detail: '내 년지 寅 ↔ 상대 년지 亥 파',
      },
      {
        kind: 'samhap_full',
        palace: null,
        palace_meaning: null,
        detail: '양측 지지에 寅·午·戌 삼합 완성',
      },
    ]);
  });

  it('자형(hyung): raw 이벤트에 pillarIndex 없음 → palace null, detail은 재계산 보강', () => {
    const selfJ = makeChart({ year: '甲子', month: null, day: '丙午', hour: null });
    const relJ = makeChart({ year: '甲子', month: null, day: '庚午', hour: null });
    expect(computeGungwiEvents(selfJ, relJ)).toEqual([
      {
        kind: 'hyung',
        palace: null,
        palace_meaning: null,
        detail: '내 년지 子 ↔ 상대 년지 子 자형',
      },
      {
        kind: 'hyung',
        palace: null,
        palace_meaning: null,
        detail: '내 일지 午 ↔ 상대 일지 午 자형',
      },
    ]);
  });

  it('시주 이벤트 발생 케이스 — 시지 충 + 반합 2건 (반합 detail 사전순)', () => {
    const selfH = makeChart({ year: '甲子', month: null, day: '乙丑', hour: '丙午' });
    const relH = makeChart({ year: '戊辰', month: null, day: '己巳', hour: '庚子' });
    expect(computeGungwiEvents(selfH, relH)).toEqual([
      {
        kind: 'chung',
        palace: '시주',
        palace_meaning: '미래·자식',
        detail: '내 시지 午 ↔ 상대 시지 子 충',
      },
      {
        kind: 'samhap_half',
        palace: null,
        palace_meaning: null,
        detail: '양측 지지에 子·辰 반합',
      },
      {
        kind: 'samhap_half',
        palace: null,
        palace_meaning: null,
        detail: '양측 지지에 巳·丑 반합',
      },
    ]);
  });

  it('hour_pillar null: 시주 쌍 자동 스킵 — 시주 이벤트 소멸, 반합은 유지', () => {
    const selfH0 = makeChart({ year: '甲子', month: null, day: '乙丑', hour: null });
    const relH0 = makeChart({ year: '戊辰', month: null, day: '己巳', hour: null });
    const events = computeGungwiEvents(selfH0, relH0);
    expect(events.every((e) => e.palace !== '시주')).toBe(true);
    expect(events).toEqual([
      {
        kind: 'samhap_half',
        palace: null,
        palace_meaning: null,
        detail: '양측 지지에 子·辰 반합',
      },
      {
        kind: 'samhap_half',
        palace: null,
        palace_meaning: null,
        detail: '양측 지지에 巳·丑 반합',
      },
    ]);
  });

  it('한쪽만 hour null이어도 시주 쌍 스킵 (양측 모두 있어야 비교)', () => {
    const selfH0 = makeChart({ year: '甲子', month: null, day: '乙丑', hour: null });
    const relH = makeChart({ year: '戊辰', month: null, day: '己巳', hour: '庚子' });
    const events = computeGungwiEvents(selfH0, relH);
    expect(events.every((e) => e.palace !== '시주')).toBe(true);
    expect(events.filter((e) => e.kind === 'chung')).toHaveLength(0);
  });

  it('한글 독음 입력도 한자 입력과 동일 결과', () => {
    const selfKo = makeChart({ year: '갑인', month: '을묘', day: '병오', hour: '정해' });
    const relationKo = makeChart({ year: '무신', month: '기유', day: '경술', hour: '신축' });
    expect(computeGungwiEvents(selfKo, relationKo)).toEqual(computeGungwiEvents(SELF, RELATION));
  });
});
