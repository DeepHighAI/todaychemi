import { describe, it, expect, vi } from 'vitest';

import {
  CROSS_ANALYSIS_VERSION,
  PALACE_MEANINGS,
  computeSipsinCross,
  computeGungwiEvents,
  computeYunseCross,
  computeCrossAnalysis,
  computeCrossAnalysisSafe,
  projectCrossForToday,
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

// ---------------------------------------------------------------------------
// 운세 교차 픽스처 — 한자/한글 동일 내용 이중 인코딩
//   self 대운 乙亥(current_index 1) / rel 대운 庚子
//   공유 레이어는 self 측 yunse가 정본 — rel 쪽은 디코이(甲子: 잘못 쓰면 子午 충 발생)
// ---------------------------------------------------------------------------
const SELF_YUNSE_HANJA: YunseCore = {
  daeun: {
    start_age: 7,
    list: [
      { age: 7, pillar: '甲子', year: 1990 },
      { age: 17, pillar: '乙亥', year: 2000 },
    ],
    current_index: 1,
  },
  seyun: { current_pillar: '辛丑', current_year: 2026 },
  wolun: { current_pillar: '癸巳', current_month: '2026-06' },
  iliun: { today_pillar: '甲辰', today_date: '2026-06-11' },
};

const REL_YUNSE_HANJA: YunseCore = {
  daeun: { start_age: 5, list: [{ age: 5, pillar: '庚子', year: 1995 }], current_index: 0 },
  seyun: { current_pillar: '甲子', current_year: 2026 },
  wolun: { current_pillar: '甲子', current_month: '2026-06' },
  iliun: { today_pillar: '甲子', today_date: '2026-06-11' },
};

const SELF_YUNSE_KO: YunseCore = {
  daeun: {
    start_age: 7,
    list: [
      { age: 7, pillar: '갑자', year: 1990 },
      { age: 17, pillar: '을해', year: 2000 },
    ],
    current_index: 1,
  },
  seyun: { current_pillar: '신축', current_year: 2026 },
  wolun: { current_pillar: '계사', current_month: '2026-06' },
  iliun: { today_pillar: '갑진', today_date: '2026-06-11' },
};

const REL_YUNSE_KO: YunseCore = {
  daeun: { start_age: 5, list: [{ age: 5, pillar: '경자', year: 1995 }], current_index: 0 },
  seyun: { current_pillar: '갑자', current_year: 2026 },
  wolun: { current_pillar: '갑자', current_month: '2026-06' },
  iliun: { today_pillar: '갑자', today_date: '2026-06-11' },
};

const SELF_Y = makeChart({ year: '甲寅', month: '乙卯', day: '丙午', hour: '丁亥' }, SELF_YUNSE_HANJA);
const REL_Y = makeChart({ year: '戊申', month: '己酉', day: '庚戌', hour: '辛丑' }, REL_YUNSE_HANJA);

describe('computeYunseCross — 양방향 운세 교차 facts', () => {
  it('대운 3방향 + 공유 레이어(세운·월운·일운) — 이벤트 발생분만 고정 순서로 기록', () => {
    expect(computeYunseCross(SELF_Y, REL_Y)).toEqual([
      // ① 내 현재 대운 乙亥 ↔ 상대 일주 庚戌: 乙庚 천간합
      {
        layer: 'daeun',
        direction: 'self_to_relation',
        kind: 'stem_hap',
        detail: '내 현재 대운(乙亥) 천간이 상대 일간(庚)과 천간합',
      },
      // ② 상대 현재 대운 庚子 ↔ 내 일주 丙午: 子午 충
      {
        layer: 'daeun',
        direction: 'relation_to_self',
        kind: 'chung',
        detail: '상대 현재 대운(庚子) 지지가 내 일지(午)와 충',
      },
      // ③ 대운 ↔ 대운: 乙庚 천간합
      {
        layer: 'daeun',
        direction: 'mutual',
        kind: 'stem_hap',
        detail: '내 현재 대운(乙亥) ↔ 상대 현재 대운(庚子) 천간합',
      },
      // ④ 세운 辛丑(공유, self 측 정본) ↔ 내 일간 丙: 丙辛 천간합
      {
        layer: 'seyun',
        direction: 'shared',
        kind: 'stem_hap',
        detail: '올해 세운(辛丑) 천간이 내 일간(丙)과 천간합',
      },
      // ⑤ 일운 甲辰 ↔ 상대 일지 戌: 辰戌 충 (월운 癸巳는 무이벤트)
      {
        layer: 'iliun',
        direction: 'shared',
        kind: 'chung',
        detail: '오늘 일진(甲辰) 지지가 상대 일지(戌)와 충',
      },
    ]);
  });

  it('한글/한자 이중 인코딩 픽스처가 동일 출력 (normalizeGanji 선적용)', () => {
    const selfKo = makeChart(
      { year: '갑인', month: '을묘', day: '병오', hour: '정해' },
      SELF_YUNSE_KO,
    );
    const relKo = makeChart(
      { year: '무신', month: '기유', day: '경술', hour: '신축' },
      REL_YUNSE_KO,
    );
    const fromKo = computeYunseCross(selfKo, relKo);
    expect(fromKo).toEqual(computeYunseCross(SELF_Y, REL_Y));
    // detail 내 간지 표기도 한자 단일 인코딩으로 수렴
    expect(fromKo[0].detail).toContain('乙亥');
  });

  it('공유 레이어는 self 측 yunse가 정본 — 상대 쪽 디코이(甲子) 미사용', () => {
    const facts = computeYunseCross(SELF_Y, REL_Y);
    // 디코이 甲子가 쓰였다면 '오늘 일진(甲子) 지지가 내 일지(午)와 충'이 생겼을 것
    expect(facts.some((f) => f.detail.includes('甲子'))).toBe(false);
  });

  it('대운 current_index 범위 밖이면 해당 측 대운 facts 스킵 (throw 금지)', () => {
    const selfBadDaeun = makeChart(
      { year: '甲寅', month: '乙卯', day: '丙午', hour: '丁亥' },
      {
        ...SELF_YUNSE_HANJA,
        daeun: { ...SELF_YUNSE_HANJA.daeun, current_index: 5 },
      },
    );
    const facts = computeYunseCross(selfBadDaeun, REL_Y);
    // ①(내 대운)·③(mutual) 소멸, ②·④·⑤만 잔존
    expect(facts).toHaveLength(3);
    expect(facts.map((f) => f.direction)).toEqual(['relation_to_self', 'shared', 'shared']);
  });

  it('무효 간지(파싱 불가) 레이어는 스킵 (throw 금지)', () => {
    const selfBadIliun = makeChart(
      { year: '甲寅', month: '乙卯', day: '丙午', hour: '丁亥' },
      {
        ...SELF_YUNSE_HANJA,
        iliun: { today_pillar: '??', today_date: '2026-06-11' },
      },
    );
    const facts = computeYunseCross(selfBadIliun, REL_Y);
    expect(facts.some((f) => f.layer === 'iliun')).toBe(false);
    expect(facts).toHaveLength(4);
  });
});

describe('computeCrossAnalysis — 통합 (ilgan_pair + mode_focus + age_gap)', () => {
  it('version + ilgan_pair(음양·천간합) + age_gap 통합 산출', () => {
    const cross = computeCrossAnalysis({
      self: SELF_Y,
      relation: REL_Y,
      mode: '썸합',
      self_birth_year: 1990,
      relation_birth_year: 1995,
    });
    expect(cross.version).toBe(CROSS_ANALYSIS_VERSION);
    expect(cross.ilgan_pair).toEqual({
      self_stem: '丙',
      relation_stem: '庚',
      self_polarity: '양',
      relation_polarity: '양',
      stem_hap: false,
      mode_focus: [
        '내 일간 기준 상대 일간 = 편재(재성)',
        '상대 일간 기준 내 일간 = 편관(관성)',
      ],
    });
    expect(cross.age_gap).toEqual({ band: '4-6', relation_is: '연하' });
    // 하위 모듈 결과와 동일 (단일 조립 — 별도 변형 없음)
    expect(cross.sipsin_cross).toEqual(computeSipsinCross(SELF_Y, REL_Y));
    expect(cross.gungwi_events).toEqual(computeGungwiEvents(SELF_Y, REL_Y));
    expect(cross.yunse_cross).toEqual(computeYunseCross(SELF_Y, REL_Y));
  });

  it('stem_hap: 丙辛 합 페어는 true', () => {
    const relHap = makeChart({ year: '戊申', month: '己酉', day: '辛丑', hour: null });
    const cross = computeCrossAnalysis({ self: SELF, relation: relHap });
    expect(cross.ilgan_pair.stem_hap).toBe(true);
    expect(cross.ilgan_pair.self_polarity).toBe('양');
    expect(cross.ilgan_pair.relation_polarity).toBe('음');
  });

  it('mode_focus: 썸합/오래합에만 존재, 그 외 모드·모드 미지정 시 키 자체 부재', () => {
    const base = { self: SELF_Y, relation: REL_Y };
    expect('mode_focus' in computeCrossAnalysis({ ...base, mode: '일합' }).ilgan_pair).toBe(false);
    expect('mode_focus' in computeCrossAnalysis(base).ilgan_pair).toBe(false);
    expect(computeCrossAnalysis({ ...base, mode: '오래합' }).ilgan_pair.mode_focus).toEqual([
      '내 일간 기준 상대 일간 = 편재(재성)',
      '상대 일간 기준 내 일간 = 편관(관성)',
    ]);
  });

  it('mode_focus: 양방향 모두 재성/관성이 아니면 빈 배열 (키는 존재)', () => {
    // 丙↔甲: 편인(인성) / 식신(식상) — 재·관 아님
    const relNoFocus = makeChart({ year: '戊申', month: '己酉', day: '甲戌', hour: '辛丑' });
    const cross = computeCrossAnalysis({ self: SELF, relation: relNoFocus, mode: '썸합' });
    expect(cross.ilgan_pair.mode_focus).toEqual([]);
  });

  it('age_gap 밴드 경계: 0=동갑 / 1-3 / 4-6 / 7+ · 연상/연하 방향', () => {
    const band = (selfYear: number, relationYear: number) =>
      computeCrossAnalysis({
        self: SELF,
        relation: RELATION,
        self_birth_year: selfYear,
        relation_birth_year: relationYear,
      }).age_gap;
    expect(band(1990, 1990)).toEqual({ band: '동갑', relation_is: '동갑' });
    expect(band(1990, 1991)).toEqual({ band: '1-3', relation_is: '연하' });
    expect(band(1990, 1993)).toEqual({ band: '1-3', relation_is: '연하' });
    expect(band(1990, 1994)).toEqual({ band: '4-6', relation_is: '연하' });
    expect(band(1990, 1996)).toEqual({ band: '4-6', relation_is: '연하' });
    expect(band(1990, 1997)).toEqual({ band: '7+', relation_is: '연하' });
    expect(band(1993, 1990)).toEqual({ band: '1-3', relation_is: '연상' });
    expect(band(1997, 1990)).toEqual({ band: '7+', relation_is: '연상' });
  });

  it('age_gap: 연도가 하나라도 없으면 키 자체 부재 (연도 원본은 출력물 미진입)', () => {
    expect('age_gap' in computeCrossAnalysis({ self: SELF, relation: RELATION })).toBe(false);
    expect(
      'age_gap' in computeCrossAnalysis({ self: SELF, relation: RELATION, self_birth_year: 1990 }),
    ).toBe(false);
    expect(
      'age_gap' in
        computeCrossAnalysis({ self: SELF, relation: RELATION, relation_birth_year: 1990 }),
    ).toBe(false);
  });

  it('PII 키 스캔: 출력 객체 어디에도 금지 세그먼트 키 없음 + 출생연도 숫자 미노출', () => {
    const cross = computeCrossAnalysis({
      self: SELF_Y,
      relation: REL_Y,
      mode: '썸합',
      self_birth_year: 1990,
      relation_birth_year: 1995,
    });
    const piiPattern = /(^|_)(name|nickname|email|gender|birth_date|birth_time|birth_place)($|_)/;
    const keys: string[] = [];
    const collect = (value: unknown): void => {
      if (Array.isArray(value)) {
        for (const item of value) collect(item);
        return;
      }
      if (value !== null && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
          keys.push(key);
          collect(child);
        }
      }
    };
    collect(cross);
    expect(keys.filter((k) => piiPattern.test(k))).toEqual([]);
    // 밴드 문자열만 출력 — 서기 연도 리터럴 직렬화 금지
    expect(JSON.stringify(cross)).not.toMatch(/\b(19|20)\d{2}\b/);
  });
});

describe('projectCrossForToday — today 전용 압축', () => {
  // 일주 궁위 이벤트(丙辛 천간합 + 午丑 해) + 일진 丙子 facts가 생기는 페어
  const TODAY_YUNSE: YunseCore = {
    ...QUIET_YUNSE,
    iliun: { today_pillar: '丙子', today_date: '2026-06-11' },
  };
  const SELF_T = makeChart({ year: '甲寅', month: '乙卯', day: '丙午', hour: '丁亥' }, TODAY_YUNSE);
  const REL_T = makeChart({ year: '戊申', month: '己酉', day: '辛丑', hour: null });

  it('일주 궁위 이벤트 detail + 오늘 일진 facts만 추출', () => {
    const cross = computeCrossAnalysis({ self: SELF_T, relation: REL_T, mode: '오래합' });
    const summary = projectCrossForToday(cross);
    expect(summary).toEqual({
      version: CROSS_ANALYSIS_VERSION,
      ilgan_pair: {
        self_stem: '丙',
        relation_stem: '辛',
        self_polarity: '양',
        relation_polarity: '음',
        stem_hap: true,
        mode_focus: [
          '내 일간 기준 상대 일간 = 정재(재성)',
          '상대 일간 기준 내 일간 = 정관(관성)',
        ],
      },
      day_palace_links: [
        '내 일지 午 ↔ 상대 일지 丑 해',
        '내 일간 丙 ↔ 상대 일간 辛 천간합',
      ],
      iliun_links: [
        '오늘 일진(丙子) 지지가 내 일지(午)와 충',
        '오늘 일진(丙子) 천간이 상대 일간(辛)과 천간합',
        '오늘 일진(丙子) 지지가 상대 일지(丑)와 지지합',
      ],
    });
  });

  it('ilgan_pair는 명시 복사 — 원본 참조 비공유', () => {
    const cross = computeCrossAnalysis({ self: SELF_T, relation: REL_T, mode: '오래합' });
    const summary = projectCrossForToday(cross);
    expect(summary.ilgan_pair).not.toBe(cross.ilgan_pair);
    expect(summary.ilgan_pair.mode_focus).not.toBe(cross.ilgan_pair.mode_focus);
  });

  it('mode_focus 부재 시 압축본에도 키 부재', () => {
    const cross = computeCrossAnalysis({ self: SELF_T, relation: REL_T });
    expect('mode_focus' in projectCrossForToday(cross).ilgan_pair).toBe(false);
  });
});

describe('computeCrossAnalysis — 결정성', () => {
  const input = {
    self: SELF_Y,
    relation: REL_Y,
    mode: '썸합' as const,
    self_birth_year: 1990,
    relation_birth_year: 1995,
  };

  it('1000회 동일 결과 (직렬화 unique set size === 1)', () => {
    const serialized = Array.from({ length: 1000 }, () =>
      JSON.stringify(computeCrossAnalysis(input)),
    );
    expect(new Set(serialized).size).toBe(1);
  });

  it('배열 순서 고정 — 두 호출의 직렬화 결과 동일 (키 삽입 순서 포함)', () => {
    expect(JSON.stringify(computeCrossAnalysis(input))).toBe(
      JSON.stringify(computeCrossAnalysis(input)),
    );
  });

  it('한글/한자 이중 인코딩 입력의 전체 결과 동일', () => {
    const selfKo = makeChart(
      { year: '갑인', month: '을묘', day: '병오', hour: '정해' },
      SELF_YUNSE_KO,
    );
    const relKo = makeChart(
      { year: '무신', month: '기유', day: '경술', hour: '신축' },
      REL_YUNSE_KO,
    );
    const fromKo = computeCrossAnalysis({ ...input, self: selfKo, relation: relKo });
    expect(fromKo).toEqual(computeCrossAnalysis(input));
  });
});

// 리뷰: 삼형(寅巳申) detail 큐 커버리지 — 자형 외 HYUNG_TRIPLES 경로 검증
describe('computeGungwiEvents — 삼형 detail', () => {
  it('양측 합산 지지에 寅巳申 → hyung 이벤트 + 삼형 구성 detail', () => {
    // self 寅·巳 + relation 申 — 합산 삼형. 부수 이벤트(寅申 충, 巳申 합·형·파)도 발생 가능.
    const selfT = makeChart({ year: '甲寅', month: '己巳', day: '丙午', hour: null });
    const relT = makeChart({ year: '壬申', month: null, day: '乙丑', hour: null });
    const events = computeGungwiEvents(selfT, relT);
    const hyungEvents = events.filter((e) => e.kind === 'hyung');
    expect(hyungEvents.length).toBeGreaterThan(0);
    const tripleDetail = hyungEvents.find((e) => e.detail.includes('삼형'));
    expect(tripleDetail).toBeDefined();
    expect(tripleDetail?.detail).toBe('양측 지지에 寅·巳·申 삼형 구성');
    expect(tripleDetail?.palace).toBeNull();
  });

  it('삼형 detail 도 결정형 (동일 입력 100회 동일 출력)', () => {
    const selfT = makeChart({ year: '甲寅', month: '己巳', day: '丙午', hour: null });
    const relT = makeChart({ year: '壬申', month: null, day: '乙丑', hour: null });
    const first = computeGungwiEvents(selfT, relT);
    for (let i = 0; i < 100; i += 1) {
      expect(computeGungwiEvents(selfT, relT)).toEqual(first);
    }
  });
});

// 리뷰 F3: 레거시 jsonb 변형 기둥 → fail-open (요청 차단 금지)
describe('computeCrossAnalysisSafe — fail-open', () => {
  it('정상 입력 → computeCrossAnalysis 동일 결과', () => {
    const input = { self: SELF, relation: RELATION };
    expect(computeCrossAnalysisSafe(input)).toEqual(computeCrossAnalysis(input));
  });

  it('변형 기둥(빈 문자열 day_pillar) → undefined + [CROSS_INVALID] warn, throw 없음', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const broken = makeChart({ year: '甲寅', month: null, day: '', hour: null });
    expect(computeCrossAnalysisSafe({ self: broken, relation: RELATION })).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith('[CROSS_INVALID]', expect.any(Object));
    warnSpy.mockRestore();
  });

  it('비간지 문자 기둥 → undefined (fail-open)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const broken = makeChart({ year: '甲寅', month: null, day: '??', hour: null });
    expect(computeCrossAnalysisSafe({ self: SELF, relation: broken })).toBeUndefined();
    warnSpy.mockRestore();
  });
});
