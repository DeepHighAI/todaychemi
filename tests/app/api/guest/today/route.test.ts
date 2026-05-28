import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers');
vi.mock('@/lib/chart/compute');
vi.mock('@/lib/legal/server-consent');
vi.mock('@/lib/llm/clients');
vi.mock('@/lib/today/openai');
vi.mock('@/lib/supabase/service-role');

import { cookies } from 'next/headers';
import { computeChart } from '@/lib/chart/compute';
import { resolveGuestLegalConsentFromCookie } from '@/lib/legal/server-consent';
import { createOpenAiClient } from '@/lib/llm/clients';
import { callDailyHapLlm } from '@/lib/today/openai';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { POST } from '@/app/api/guest/today/route';
import type { ChartCore } from '@/types/chart';
import type { DailyHapCard } from '@/types/dailyHap';

const VALID_BODY = {
  nickname: '하늘달',
  birth_date: '1991-03-15',
  birth_date_calendar: 'solar',
  is_lunar_leap: false,
  birth_time_knowledge: 'exact',
  birth_time: '14:30',
  gender: 'F',
};

const CHART: ChartCore = {
  year_pillar: '辛未',
  month_pillar: '癸卯',
  day_pillar: '甲戌',
  hour_pillar: '甲申',
  day_master_element: '목',
  five_elements_counts: { 목: 2, 화: 1, 토: 2, 금: 1, 수: 2 },
  gender_normalized: 'F',
  yunse: {
    daeun: { start_age: 7, list: [{ age: 7, pillar: '갑자', year: 1990 }], current_index: 0 },
    seyun: { current_pillar: '병오', current_year: 2026 },
    wolun: { current_pillar: '계사', current_month: '2026-05' },
    iliun: { today_pillar: '갑자', today_date: '2026-05-07' },
  },
};

const CARD: DailyHapCard = {
  headline: '오늘은 정리하기 좋아요.',
  headline_reason: '목 기운이 차분하게 흐릅니다.',
  avoid_phrase: '급하게 단정하는 말',
  avoid_phrase_reason: '서두르면 흐름을 놓칠 수 있어요.',
  favorable_action: '할 일을 한 줄로 적기',
  favorable_action_reason: '작게 정리하면 하루가 편해져요.',
  reused_from_yesterday: false,
};

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/guest/today', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('KASI_SERVICE_KEY', 'kasi-key');
  vi.mocked(cookies).mockResolvedValue({ get: vi.fn(), set: vi.fn() } as never);
  vi.mocked(createServiceRoleClient).mockReturnValue({ from: vi.fn() } as never);
  vi.mocked(resolveGuestLegalConsentFromCookie).mockResolvedValue({
    termsVersion: '2026-06-01',
    privacyVersion: '2026-06-01',
    ageConfirmed: true,
    consentedAt: '2026-06-01T00:00:00.000Z',
  });
  vi.mocked(computeChart).mockResolvedValue({ chart_core: CHART, chart_hash: 'a'.repeat(64) });
  vi.mocked(createOpenAiClient).mockReturnValue({} as never);
  vi.mocked(callDailyHapLlm).mockResolvedValue(CARD);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('POST /api/guest/today', () => {
  it('returns a guest-only today card and chart without requiring auth', async () => {
    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, card: CARD, chart: CHART });
    expect(computeChart).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_id: 'guest',
        birth_date: '1991-03-15',
        gender: 'F',
      }),
      expect.any(String),
    );
    // C5: callDailyHapLlm(input, openai, supabase, userId). guest 는 relation_chart=null +
    // fixed sentinel userId='__guest__' + service-role client (Task 2 / ADR-008).
    expect(callDailyHapLlm).toHaveBeenCalledWith(
      expect.objectContaining({
        self_chart: CHART,
        relation_chart: null,
        today_date: expect.any(String),
      }),
      expect.anything(),
      expect.anything(),
      '__guest__',
    );
  });

  it('403 when guest legal consent cookie is missing or expired', async () => {
    vi.mocked(resolveGuestLegalConsentFromCookie).mockResolvedValue(null);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('LEGAL_CONSENT_REQUIRED');
    expect(computeChart).not.toHaveBeenCalled();
  });

  it('400 when body is invalid', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, birth_place: '서울' }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_BODY');
  });
});
