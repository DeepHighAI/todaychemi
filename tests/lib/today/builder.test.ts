import { describe, it, expect, vi } from 'vitest';
import { buildDailyHap, type BuildDailyHapDeps } from '@/lib/today/builder';
import type { DailyHapCard } from '@/types/dailyHap';

const CARD: DailyHapCard = {
  headline: '오늘은 집중력이 좋아요.',
  headline_reason: '木기운이 왕성해서 판단력이 예리합니다.',
  avoid_phrase: '충동적인 발언',
  avoid_phrase_reason: '火와 충돌할 수 있어요.',
  favorable_action: '집중이 필요한 작업 처리',
  favorable_action_reason: '木의 날카로움 활용.',
  reused_from_yesterday: false,
};

function makeDeps(overrides: Partial<BuildDailyHapDeps> = {}): BuildDailyHapDeps {
  return {
    fetchTodayCache: vi.fn().mockResolvedValue(null),
    fetchYesterdayCache: vi.fn().mockResolvedValue(null),
    fetchUserChart: vi.fn().mockResolvedValue({
      year_pillar: '갑자', month_pillar: '을축', day_pillar: '병인', hour_pillar: null,
      day_master_element: '화', five_elements_counts: { 목: 2, 화: 1, 토: 0, 금: 0, 수: 1 },
      gender_normalized: 'M' as const,
    }),
    callLlm: vi.fn().mockResolvedValue(CARD),
    saveCard: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('buildDailyHap', () => {
  it('cache hit → callLlm 미호출, 캐시 카드 반환', async () => {
    const cached = { ...CARD, headline: '캐시된 오늘 카드' };
    const deps = makeDeps({ fetchTodayCache: vi.fn().mockResolvedValue(cached) });
    const result = await buildDailyHap(deps);
    expect(result?.headline).toBe('캐시된 오늘 카드');
    expect(deps.callLlm).not.toHaveBeenCalled();
  });

  it('cache miss → callLlm 호출 1회 + saveCard 호출', async () => {
    const deps = makeDeps();
    const result = await buildDailyHap(deps);
    expect(deps.callLlm).toHaveBeenCalledOnce();
    expect(deps.saveCard).toHaveBeenCalledOnce();
    expect(result?.headline).toBe(CARD.headline);
  });

  it('llm 실패 + 어제 카드 존재 → reused_from_yesterday=true', async () => {
    const yesterday = { ...CARD, headline: '어제 카드', reused_from_yesterday: false };
    const deps = makeDeps({
      callLlm: vi.fn().mockRejectedValue(new Error('LLM error')),
      fetchYesterdayCache: vi.fn().mockResolvedValue(yesterday),
    });
    const result = await buildDailyHap(deps);
    expect(result?.reused_from_yesterday).toBe(true);
    expect(result?.headline).toBe('어제 카드');
  });

  it('llm 실패 + 어제 카드 없음 → 템플릿 카드 반환 (not null)', async () => {
    const deps = makeDeps({
      callLlm: vi.fn().mockRejectedValue(new Error('LLM error')),
    });
    const result = await buildDailyHap(deps);
    expect(result).not.toBeNull();
    expect(typeof result?.headline).toBe('string');
  });

  it('chart 없으면 템플릿 카드 반환 (callLlm 미호출)', async () => {
    const deps = makeDeps({ fetchUserChart: vi.fn().mockResolvedValue(null) });
    const result = await buildDailyHap(deps);
    expect(deps.callLlm).not.toHaveBeenCalled();
    expect(result).not.toBeNull();
  });
});
