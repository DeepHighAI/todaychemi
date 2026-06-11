import type { ChartCore } from '@/types/chart';
import {
  HEAVENLY_STEMS,
  EARTHLY_BRANCHES,
} from '@/lib/kasi/constants';
import {
  STEM_HAP,
  BRANCH_HAP,
  SAMHAP,
  CHUNG,
  HYUNG_TRIPLES,
  HYUNG_SELF,
  HYUNG_SCORE,
  PA,
  HAE,
} from '@/lib/scoring/constants';

export interface HapChungEvent {
  type:
    | 'stem_hap'
    | 'branch_hap'
    | 'samhap_full'
    | 'samhap_half'
    | 'chung'
    | 'hyung'
    | 'pa'
    | 'hae';
  score: number;
  pillarIndex?: number;   // 0=연주 1=월주 2=일주 3=시주 (자형 hyung 도 동일 슬롯이라 보유)
  hasPriorityBonus?: boolean; // §2.5 합 우선 가중 마킹
  // 참여 지지 메타데이터 (형·삼합 계열 전용) — 점수 산출 무영향, 소비자(교차분석 detail)용.
  // 삼형=트리플 3지지 / 자형=해당 지지 1개 / 삼합=그룹 3지지 / 반합=성립 2지지 (그룹 고정 순서)
  participants?: string[];
}

// 천간 순서 기준 정규화 키
function stemKey(a: string, b: string): string {
  const ia = HEAVENLY_STEMS.indexOf(a as (typeof HEAVENLY_STEMS)[number]);
  const ib = HEAVENLY_STEMS.indexOf(b as (typeof HEAVENLY_STEMS)[number]);
  return ia <= ib ? a + b : b + a;
}

// 지지 순서 기준 정규화 키
function branchKey(a: string, b: string): string {
  const ia = EARTHLY_BRANCHES.indexOf(a as (typeof EARTHLY_BRANCHES)[number]);
  const ib = EARTHLY_BRANCHES.indexOf(b as (typeof EARTHLY_BRANCHES)[number]);
  return ia <= ib ? a + b : b + a;
}

// 2-char 기둥을 천간 + 지지로 분해
function splitPillar(p: string): { stem: string; branch: string } {
  return { stem: p[0], branch: p[1] };
}

// 두 차트의 4기둥 쌍 배열: [(self_pillar, rel_pillar, pillarIndex), ...]
function pillarPairs(
  self: ChartCore,
  rel: ChartCore,
): Array<{ sp: string; rp: string; idx: number }> {
  const selfPillars = [
    self.year_pillar,
    self.month_pillar ?? '',
    self.day_pillar,
    self.hour_pillar ?? '',
  ];
  const relPillars = [
    rel.year_pillar,
    rel.month_pillar ?? '',
    rel.day_pillar,
    rel.hour_pillar ?? '',
  ];
  const pairs: Array<{ sp: string; rp: string; idx: number }> = [];
  for (let i = 0; i < 4; i++) {
    if (selfPillars[i] && relPillars[i]) {
      pairs.push({ sp: selfPillars[i], rp: relPillars[i], idx: i });
    }
  }
  return pairs;
}

// 모든 기둥에서 지지 목록 수집
function allBranches(chart: ChartCore): string[] {
  const pillars = [
    chart.year_pillar,
    chart.month_pillar ?? '',
    chart.day_pillar,
    chart.hour_pillar ?? '',
  ];
  return pillars.filter(Boolean).map((p) => p[1]);
}

export function computeHapChungHyungHaeRaw(self: ChartCore, rel: ChartCore): HapChungEvent[] {
  const events: HapChungEvent[] = [];
  const pairs = pillarPairs(self, rel);

  // 기둥별 합 이벤트 추적 (§2.5 중복합 보너스용)
  const stemHapByPillar = new Set<number>();
  const branchHapByPillar = new Set<number>();

  // 기둥별 충 발생 여부 (§2.5 합 우선 가중용)
  const chungPillarIdx = new Set<number>();

  // 1차 패스: 충 발생 기둥 수집
  for (const { sp, rp, idx } of pairs) {
    const { branch: sb } = splitPillar(sp);
    const { branch: rb } = splitPillar(rp);
    const bk = branchKey(sb, rb);
    if (CHUNG[bk] !== undefined) {
      chungPillarIdx.add(idx);
    }
  }

  // 2차 패스: 전체 이벤트 산출
  for (const { sp, rp, idx } of pairs) {
    const { stem: ss, branch: sb } = splitPillar(sp);
    const { stem: rs, branch: rb } = splitPillar(rp);

    // 천간합
    const sk = stemKey(ss, rs);
    if (STEM_HAP[sk] !== undefined) {
      stemHapByPillar.add(idx);
      events.push({ type: 'stem_hap', score: STEM_HAP[sk], pillarIndex: idx });
    }

    // 지지합
    const bk = branchKey(sb, rb);
    if (BRANCH_HAP[bk] !== undefined) {
      const hasPriorityBonus = chungPillarIdx.has(idx);
      branchHapByPillar.add(idx);
      events.push({
        type: 'branch_hap',
        score: BRANCH_HAP[bk],
        pillarIndex: idx,
        hasPriorityBonus,
      });
    }

    // 충
    if (CHUNG[bk] !== undefined) {
      events.push({ type: 'chung', score: CHUNG[bk], pillarIndex: idx });
    }

    // 파
    if (PA[bk] !== undefined) {
      events.push({ type: 'pa', score: PA[bk], pillarIndex: idx });
    }

    // 해
    if (HAE[bk] !== undefined) {
      events.push({ type: 'hae', score: HAE[bk], pillarIndex: idx });
    }
  }

  // 형: 두 차트 합산 지지 목록으로 판단
  const selfBranches = allBranches(self);
  const relBranches = allBranches(rel);
  const combined = [...selfBranches, ...relBranches];

  // 삼형
  for (const triple of HYUNG_TRIPLES) {
    if (triple.every((b) => combined.includes(b))) {
      events.push({ type: 'hyung', score: HYUNG_SCORE, participants: [...triple] });
    }
  }

  // 자형: 같은 기둥 위치에서 동일 자형 지지 쌍 — 동일 슬롯이라 pillarIndex 귀속 가능
  for (const { sp, rp, idx } of pairs) {
    const sb = sp[1];
    const rb = rp[1];
    if (sb === rb && HYUNG_SELF.has(sb)) {
      events.push({ type: 'hyung', score: HYUNG_SCORE, pillarIndex: idx, participants: [sb] });
    }
  }

  // 삼합·반합: 두 차트 합산 지지에서 그룹 매칭
  for (const group of SAMHAP) {
    const present = group.full.filter((b) => combined.includes(b));
    if (present.length === 3) {
      // 전체 삼합 — 중복 반합 억제
      events.push({ type: 'samhap_full', score: group.fullScore, participants: [...group.full] });
    } else if (present.length === 2) {
      // 반합: 두 개 중 적어도 하나가 self, 하나가 rel
      const inSelf = group.full.filter((b) => selfBranches.includes(b)).length;
      const inRel = group.full.filter((b) => relBranches.includes(b)).length;
      if (inSelf >= 1 && inRel >= 1) {
        events.push({ type: 'samhap_half', score: group.halfScore, participants: present });
      }
    }
  }

  return events;
}

// §2.5·§2.6 정규화
// S = clamp( ((sum_score + 50) / 100) * 100, 0, 100 )
export function normalizeHapChungHyungHae(events: HapChungEvent[]): number {
  // §2.5 중복 합 보너스: 같은 기둥에서 천간합·지지합 동시 발생
  const pillarHapTypes = new Map<number, Set<string>>();
  for (const e of events) {
    if (e.pillarIndex !== undefined && (e.type === 'stem_hap' || e.type === 'branch_hap')) {
      if (!pillarHapTypes.has(e.pillarIndex)) pillarHapTypes.set(e.pillarIndex, new Set());
      pillarHapTypes.get(e.pillarIndex)!.add(e.type);
    }
  }
  let dupHapBonus = 0;
  for (const types of pillarHapTypes.values()) {
    if (types.has('stem_hap') && types.has('branch_hap')) {
      dupHapBonus += 5; // §2.5 중복 합 보너스 +5
    }
  }

  // §2.5 중복 충 페널티 수집: 같은 기둥 idx에 충이 2+ 발생 시 −3 (현 구현에서는 기둥당 1충이므로 미해당)
  // → 이벤트 배열 합산에 포함

  let sum = dupHapBonus;
  for (const e of events) {
    if (e.hasPriorityBonus) {
      // §2.5 합 우선 가중 1.2x
      sum += e.score * 1.2;
    } else {
      sum += e.score;
    }
  }

  return Math.max(0, Math.min(100, ((sum + 50) / 100) * 100));
}
