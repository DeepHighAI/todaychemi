import type { ChartCore, OhaengElement } from '@/types/chart';

export type DailyTalismanTheme = 'emotion' | 'growth' | 'center' | 'boundary' | 'clarity';
export type DailyTalismanStrokeCount = 3 | 4 | 5 | 6 | 7 | 8;

export interface DailyTalisman {
  id: string;
  date: string;
  /** 오늘 채우면 좋은 기운(용신). 파생 부재 시 최소 카운트 오행 폴백. */
  element: OhaengElement;
  theme: DailyTalismanTheme;
  glyph: string;
  strokeCount: DailyTalismanStrokeCount;
  meaning: string;
  title: string;
  gapLabel: string;
  guardLabel: string;
  actionText: string;
}

export interface DailyTalismanStatus {
  date: string;
  talismanId: string;
  completedAt: string;
}

const ELEMENT_ORDER: OhaengElement[] = ['목', '화', '토', '금', '수'];

const TALISMAN_VARIANTS: Record<OhaengElement, Omit<DailyTalisman, 'id' | 'date' | 'element'>[]> = {
  목: [
    {
      theme: 'growth',
      glyph: '伸',
      strokeCount: 7,
      meaning: '펴기',
      title: '시작 가드',
      gapLabel: '오늘은 먼저 말문을 여는 힘이 약해질 수 있어요',
      guardLabel: '시작 가드 ON',
      actionText: '작은 제안 하나만 먼저 꺼내면 오늘 케미가 덜 멈춰요.',
    },
    {
      theme: 'growth',
      glyph: '生',
      strokeCount: 5,
      meaning: '살림',
      title: '새싹 가드',
      gapLabel: '오늘은 좋은 생각을 미루기 쉬운 흐름이에요',
      guardLabel: '새싹 가드 ON',
      actionText: '생각난 일을 하나만 적어두면 흐름이 다시 살아나요.',
    },
    {
      theme: 'growth',
      glyph: '育',
      strokeCount: 8,
      meaning: '키움',
      title: '온기 가드',
      gapLabel: '오늘은 관계를 키우는 말이 늦게 나올 수 있어요',
      guardLabel: '온기 가드 ON',
      actionText: '상대의 좋은 점 하나만 말로 짚어주면 사이가 자라나요.',
    },
    {
      theme: 'growth',
      glyph: '芽',
      strokeCount: 8,
      meaning: '싹',
      title: '한 걸음 가드',
      gapLabel: '오늘은 시작을 자꾸 미루기 쉬운 흐름이에요',
      guardLabel: '한 걸음 가드 ON',
      actionText: '딱 한 걸음만 먼저 떼면 나머지가 한결 가벼워져요.',
    },
  ],
  화: [
    {
      theme: 'emotion',
      glyph: '和',
      strokeCount: 8,
      meaning: '화해',
      title: '감정 가드',
      gapLabel: '오늘은 말의 온도가 낮아 오해가 생기기 쉬워요',
      guardLabel: '감정 가드 ON',
      actionText: '답장 전 한 박자 쉬면 오늘 케미가 덜 흔들려요.',
    },
    {
      theme: 'emotion',
      glyph: '忍',
      strokeCount: 7,
      meaning: '참음',
      title: '말투 가드',
      gapLabel: '오늘은 감정이 늦게 올라와도 말이 먼저 나갈 수 있어요',
      guardLabel: '말투 가드 ON',
      actionText: '끝말을 조금만 부드럽게 바꾸면 다툼을 피해가기 좋아요.',
    },
    {
      theme: 'emotion',
      glyph: '心',
      strokeCount: 4,
      meaning: '마음',
      title: '온도 가드',
      gapLabel: '오늘은 말의 온도가 차게 느껴지기 쉬워요',
      guardLabel: '온도 가드 ON',
      actionText: '첫 마디를 한 톤만 따뜻하게 열면 대화가 부드러워져요.',
    },
    {
      theme: 'emotion',
      glyph: '休',
      strokeCount: 6,
      meaning: '쉼',
      title: '여유 가드',
      gapLabel: '오늘은 사소한 일에 표정이 굳기 쉬운 날이에요',
      guardLabel: '여유 가드 ON',
      actionText: '한 번 가볍게 웃어 넘기면 분위기가 금세 풀려요.',
    },
  ],
  토: [
    {
      theme: 'center',
      glyph: '安',
      strokeCount: 6,
      meaning: '안정',
      title: '중심 가드',
      gapLabel: '오늘은 마음의 중심이 흔들리기 쉬운 날이에요',
      guardLabel: '중심 가드 ON',
      actionText: '해야 할 일을 하나로 줄이면 오늘의 리듬이 안정돼요.',
    },
    {
      theme: 'center',
      glyph: '定',
      strokeCount: 8,
      meaning: '정함',
      title: '정돈 가드',
      gapLabel: '오늘은 주변 말에 기준이 흐려질 수 있어요',
      guardLabel: '정돈 가드 ON',
      actionText: '결정 전 기준 하나를 정하면 마음이 덜 흔들려요.',
    },
    {
      theme: 'center',
      glyph: '平',
      strokeCount: 5,
      meaning: '고름',
      title: '균형 가드',
      gapLabel: '오늘은 한쪽으로 마음이 기울기 쉬운 흐름이에요',
      guardLabel: '균형 가드 ON',
      actionText: '양쪽 입장을 한 줄씩 적어보면 마음이 고르게 서요.',
    },
    {
      theme: 'center',
      glyph: '中',
      strokeCount: 4,
      meaning: '중심',
      title: '여백 가드',
      gapLabel: '오늘은 마음의 여유가 얇아지기 쉬워요',
      guardLabel: '여백 가드 ON',
      actionText: '급한 답을 한 박자 미루면 중심이 다시 서요.',
    },
  ],
  금: [
    {
      theme: 'boundary',
      glyph: '守',
      strokeCount: 6,
      meaning: '지킴',
      title: '경계 가드',
      gapLabel: '오늘은 내 선을 늦게 알아차리기 쉬워요',
      guardLabel: '경계 가드 ON',
      actionText: '어려운 부탁에는 바로 답하지 말고 시간을 조금 남겨두세요.',
    },
    {
      theme: 'boundary',
      glyph: '正',
      strokeCount: 5,
      meaning: '바름',
      title: '기준 가드',
      gapLabel: '오늘은 기준 없이 맞춰주다 지칠 수 있어요',
      guardLabel: '기준 가드 ON',
      actionText: '가능한 것과 어려운 것을 한 문장으로 나누면 편해져요.',
    },
    {
      theme: 'boundary',
      glyph: '止',
      strokeCount: 4,
      meaning: '멈춤',
      title: '매듭 가드',
      gapLabel: '오늘은 거절을 미루다 일이 커질 수 있어요',
      guardLabel: '매듭 가드 ON',
      actionText: "어려운 건 '오늘은 어려워요' 한 마디로 깔끔히 매듭지으세요.",
    },
    {
      theme: 'boundary',
      glyph: '分',
      strokeCount: 4,
      meaning: '나눔',
      title: '절제 가드',
      gapLabel: '오늘은 한 번에 다 맞춰주다 지치기 쉬워요',
      guardLabel: '절제 가드 ON',
      actionText: '오늘 할 만큼만 정해두면 끝까지 편하게 갈 수 있어요.',
    },
  ],
  수: [
    {
      theme: 'clarity',
      glyph: '明',
      strokeCount: 8,
      meaning: '밝힘',
      title: '생각 가드',
      gapLabel: '오늘은 생각이 빨리 차올라 말이 복잡해질 수 있어요',
      guardLabel: '생각 가드 ON',
      actionText: '결론을 먼저 말하면 대화가 더 맑게 흘러가요.',
    },
    {
      theme: 'clarity',
      glyph: '知',
      strokeCount: 8,
      meaning: '앎',
      title: '고요 가드',
      gapLabel: '오늘은 머릿속 소리가 많아 집중이 흩어질 수 있어요',
      guardLabel: '고요 가드 ON',
      actionText: '알림을 잠깐 줄이면 필요한 말만 남기기 쉬워요.',
    },
    {
      theme: 'clarity',
      glyph: '言',
      strokeCount: 7,
      meaning: '말',
      title: '정리 가드',
      gapLabel: '오늘은 생각이 많아 핵심이 흐려지기 쉬워요',
      guardLabel: '정리 가드 ON',
      actionText: '하고 싶은 말을 한 문장으로 줄이면 더 잘 전해져요.',
    },
    {
      theme: 'clarity',
      glyph: '水',
      strokeCount: 4,
      meaning: '물',
      title: '흐름 가드',
      gapLabel: '오늘은 말이 막혀 답답해지기 쉬운 날이에요',
      guardLabel: '흐름 가드 ON',
      actionText: '결론부터 흘려보내면 대화가 다시 트여요.',
    },
  ],
};

function stableHash(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stableIndex(seed: string, length: number): number {
  return stableHash(seed) % length;
}

const ELEMENT_SET = new Set<OhaengElement>(ELEMENT_ORDER);

function isOhaengElement(value: unknown): value is OhaengElement {
  return typeof value === 'string' && ELEMENT_SET.has(value as OhaengElement);
}

/**
 * 최소 카운트 오행(레거시 v2 폴백). 카운트가 없거나 합이 0이면 null.
 * 0 카운트는 유효(부족 오행)하지만, 전부 0(데이터 없음)은 null 처리한다.
 */
function weakestByCount(chart: ChartCore, date: string): OhaengElement | null {
  const counts = chart.five_elements_counts;
  if (!counts || typeof counts !== 'object') return null;
  const present = ELEMENT_ORDER.filter((element) => typeof counts[element] === 'number');
  if (present.length === 0) return null;
  const total = present.reduce((sum, element) => sum + counts[element], 0);
  if (total === 0) return null;
  const min = Math.min(...present.map((element) => counts[element]));
  const candidates = present.filter((element) => counts[element] === min);
  if (candidates.length === 1) return candidates[0];
  const seed = `${date}:${chart.day_master_element}:${chart.day_pillar}:${chart.yunse?.iliun?.today_pillar ?? ''}`;
  return candidates[stableIndex(seed, candidates.length)];
}

/**
 * 오늘의 부적이 채울 기운을 결정한다(결정형, ADR-040·ADR-018).
 * 1순위 = 파생 용신(yongsin.primary) — 케미카드 LLM 과 동일 근거(신규 명리 주장 아님).
 * 2순위 = 최소 카운트 오행(레거시 v2 차트로 derived 부재 시 폴백).
 * 둘 다 불가하면 null → 부적 미노출(C1 크래시 가드).
 */
function selectElement(chart: ChartCore, date: string): OhaengElement | null {
  const yongsin = chart.derived?.yongsin?.primary;
  if (isOhaengElement(yongsin)) return yongsin;
  return weakestByCount(chart, date);
}

export function buildDailyTalisman(chart: ChartCore, date: string): DailyTalisman | null {
  const element = selectElement(chart, date);
  if (element === null) return null;
  const variants = TALISMAN_VARIANTS[element];
  const seed = `${date}:${element}:${chart.day_master_element}:${chart.day_pillar}:${chart.yunse?.iliun?.today_pillar ?? ''}`;
  const variant = variants[stableIndex(seed, variants.length)];

  return {
    ...variant,
    id: `${date}:${element}:${variant.glyph}`,
    date,
    element,
  };
}

export function dailyTalismanStorageKey(chart: ChartCore, date: string): string {
  // v2: 요소 선택 근거를 최소카운트→용신으로 전환(ADR-040). 배포 시 당일 1회 리셋 수용.
  return `todaychemi:daily-talisman:v2:${date}:${chart.day_pillar}`;
}

// ── 연속 봉인 streak (리텐션 루프) ──────────────────────────────────────────
export interface DailyTalismanStreak {
  count: number;
  lastDate: string; // YYYY-MM-DD (KST)
}

// 차트와 무관한 단일 키 — 인연·요소가 바뀌어도 연속 봉인 자체를 추적한다.
export const DAILY_TALISMAN_STREAK_KEY = 'todaychemi:daily-talisman:streak:v1';

/** YYYY-MM-DD 의 전날(UTC 기준 산술, 결정형 — Date.now 미사용). 파싱 실패 시 ''. */
function previousDay(date: string): string {
  const ms = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(ms)) return '';
  return new Date(ms - 86_400_000).toISOString().slice(0, 10);
}

/**
 * 오늘 봉인 시 연속일을 갱신한다(결정형·멱등).
 * 어제 봉인 → +1, 오늘 이미 반영 → 유지(중복 봉인 방어), 그 외(끊김·첫날) → 1.
 */
export function advanceStreak(
  prev: DailyTalismanStreak | null,
  today: string,
): DailyTalismanStreak {
  if (!prev || typeof prev.count !== 'number' || typeof prev.lastDate !== 'string') {
    return { count: 1, lastDate: today };
  }
  if (prev.lastDate === today) return prev;
  if (prev.lastDate === previousDay(today)) return { count: prev.count + 1, lastDate: today };
  return { count: 1, lastDate: today };
}
