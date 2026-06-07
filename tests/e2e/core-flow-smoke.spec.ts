import { expect, test, type Page } from '@playwright/test';

const FRAMEWORK_ERROR_TEXT = [
  'Unhandled Runtime Error',
  'Application error',
  'Hydration failed',
  'This page could not be found',
];

const runtimeErrors = new WeakMap<Page, string[]>();

const mockChart = {
  year_pillar: '갑자',
  month_pillar: '을축',
  day_pillar: '병인',
  hour_pillar: null,
  day_master_element: '화',
  five_elements_counts: { 목: 2, 화: 3, 토: 1, 금: 1, 수: 1 },
  gender_normalized: 'F',
  yunse: {
    daeun: {
      start_age: 7,
      current_index: 1,
      list: [
        { age: 7, pillar: '갑자', year: 2033 },
        { age: 17, pillar: '을축', year: 2043 },
      ],
    },
    seyun: { current_pillar: '병오', current_year: 2026 },
    wolun: { current_pillar: '정미', current_month: '2026-05' },
    iliun: { today_pillar: '무신', today_date: '2026-05-31' },
  },
};

const mockWallet = {
  ok: true,
  balance: {
    balance: 12,
    next_expiry_at: null,
    next_expiry_amount: 0,
    monthly_used: 4,
    monthly_buckets: Array.from({ length: 14 }, (_, index) => (index === 13 ? 4 : 0)),
  },
  ledger: [
    {
      ledger_id: 'ledger-launch-smoke',
      user_id: 'user-launch-smoke',
      delta: 10,
      reason: 'purchase',
      reference_id: 'payment-launch-smoke',
      balance_after: 12,
      created_at: '2026-05-31T00:00:00.000Z',
    },
  ],
  has_more: false,
};

const mockDailyCard = {
  headline: '오늘은 관계를 천천히 맞추기 좋은 날이에요.',
  headline_reason: '서두르기보다 작은 약속을 확인하면 흐름이 안정돼요.',
  avoid_phrase: '왜 아직 안 했어?',
  avoid_phrase_reason: '재촉처럼 들릴 수 있어요.',
  favorable_action: '먼저 고맙다고 말하기',
  favorable_action_reason: '상대가 편하게 반응할 여지가 생겨요.',
  reused_from_yesterday: false,
  relation_id: 'relation-launch-smoke',
  relation_nickname: '테스트인연',
  today_compat_score: 72,
};

const mockFeedItems = [
  {
    relation_id: 'relation-launch-smoke',
    nickname: '테스트인연',
    mode: '썸합',
    compat_score: 76,
    change_score: 8,
    has_significant_change: true,
    created_at: '2026-05-31T00:00:00.000Z',
  },
];

const mockHapcard = {
  hapcard_id: 'hapcard-launch-smoke',
  user_id: 'user-launch-smoke',
  relation_id: 'relation-launch-smoke',
  mode: '썸합',
  target_date: '2026-05-31',
  compat_score: 76,
  score_breakdown: {
    hap_chung_hyung_hae: 20,
    sipsin: 18,
    ohaeng: 16,
    yunse_adjustment: 4,
    mode_adjustment: 2,
  },
  content: {
    main_text: '결론: 오늘은 대화가 잘 맞는 흐름이에요. 강점: 서로 편하게 반응할 수 있어요. 주의: 속도를 너무 높이면 부담이 생겨요.',
    cause_factors: [{ name: '대화 흐름', effect: '말의 온도가 안정적이에요.' }],
    classic_citation: [{ source: 'launch-smoke', original: '테스트 원문', modern: '테스트 해석' }],
    actions: ['먼저 짧게 안부를 물어보세요.', '약속 시간을 한 번 더 확인하세요.', '답장을 재촉하지 마세요.'],
    why_cards: [
      { title: '강점', reason: '서로 편안하게 반응하는 흐름이 있어요.' },
      { title: '주의', reason: '빠르게 단정하면 긴장이 생길 수 있어요.' },
    ],
    area_scores: { talk: 78, attract: 74, speed: 63, money: 58, future: 69 },
  },
  prompt_version: 'v0.8',
  llm_model: 'gpt-5',
  cache_key: 'launch-smoke',
  user_chart_hash: 'user-chart-launch-smoke',
  relation_chart_hash: 'relation-chart-launch-smoke',
  archived_at: null,
  version_label: null,
  created_at: '2026-05-31T00:00:00.000Z',
  visuals: {
    user: {
      day_pillar: '병인',
      day_master_element: '화',
      five_elements_counts: { 목: 2, 화: 3, 토: 1, 금: 1, 수: 1 },
    },
    relation: {
      day_pillar: '경신',
      day_master_element: '금',
      five_elements_counts: { 목: 1, 화: 1, 토: 2, 금: 3, 수: 1 },
    },
  },
  relation_nickname: '테스트인연',
  relation_gender_normalized: 'F',
};

const mockWhatif = {
  id: 'whatif-launch-smoke',
  user_id: 'user-launch-smoke',
  type: 'work',
  content: {
    body: '일할 때는 기준을 먼저 세우고 작게 합의하는 방식이 잘 맞아요. 오늘은 큰 결정보다 역할과 마감 기준을 한 줄로 정리하면 흐름이 안정됩니다.',
    keywords: ['정리', '기준', '협업', '속도', '확인'],
    do_first: ['할 일을 한 줄로 적기', '마감 기준을 먼저 묻기', '확인 메시지를 남기기'],
    classic_citation: [
      {
        asset_id: 'classic-launch-smoke',
        source_title: '테스트 고전',
        source_chapter: '1',
        original_text: '테스트 원문',
        modern_translation: '테스트 해석',
      },
    ],
  },
  prompt_version: 'v0.8',
  llm_model: 'gpt-5',
  cache_key: 'whatif-launch-smoke',
  chart_hash: 'user-chart-launch-smoke',
  created_at: '2026-05-31T00:00:00.000Z',
};

function authCredentials() {
  return {
    email: process.env.E2E_AUTH_EMAIL ?? process.env.TEST_EMAIL ?? 'Test1@test.com',
    password: process.env.E2E_AUTH_PASSWORD ?? process.env.TEST_PASSWORD ?? 'test1234',
  };
}

async function expectNoFrameworkOverlay(page: Page) {
  for (const text of FRAMEWORK_ERROR_TEXT) {
    await expect(page.getByText(text, { exact: false })).toHaveCount(0);
  }
}

async function expectHealthyPage(page: Page) {
  await expect(page.locator('body')).not.toBeEmpty();
  await expectNoFrameworkOverlay(page);
}

async function waitForLoginSuccessOrError(page: Page): Promise<'success' | 'error'> {
  return Promise.race([
    page.waitForURL((url) => url.pathname === '/legal/privacy', { timeout: 10_000 }).then(() => 'success' as const),
    page.getByText('이메일 또는 비밀번호가 올바르지 않아요.').waitFor({ state: 'visible', timeout: 10_000 }).then(() => 'error' as const),
  ]);
}

async function submitEmailLogin(page: Page): Promise<void> {
  await page.getByRole('button', { name: /이메일로 로그인/ }).click();

  const firstAttempt = await waitForLoginSuccessOrError(page);
  if (firstAttempt === 'success') return;

  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /이메일로 로그인/ }).click();
  const secondAttempt = await waitForLoginSuccessOrError(page);
  if (secondAttempt === 'success') return;

  throw new Error('Seeded auth smoke login failed. Run pnpm seed:test-user or set E2E_AUTH_EMAIL/E2E_AUTH_PASSWORD.');
}

async function login(page: Page) {
  const { email, password } = authCredentials();
  await page.goto('/login?next=/legal/privacy');
  await page.getByRole('textbox', { name: /이메일/ }).fill(email);
  await page.getByLabel(/비밀번호/).fill(password);
  await submitEmailLogin(page);
}

async function mockJson(page: Page, url: string, body: unknown, status = 200) {
  await page.route(url, async (route) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

async function installCoreMocks(page: Page) {
  await mockJson(page, '**/api/rewards/session', { ok: true, reward: { reason: 'ALREADY_AWARDED' } });
  await mockJson(page, '**/api/today', { ok: true, card: mockDailyCard });
  await mockJson(page, '**/api/me/chart', { ok: true, chart: mockChart });
  await mockJson(page, '**/api/me/wallet', mockWallet);
  await page.route('**/api/relations', async (route) => {
    const body = route.request().method() === 'POST'
      ? { ok: true, relation_id: 'relation-launch-smoke' }
      : { items: mockFeedItems };

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
  await mockJson(page, '**/api/feed', { items: mockFeedItems });
  await mockJson(page, '**/api/hapcards', mockHapcard);
  await mockJson(page, '**/api/hapcards/hapcard-launch-smoke/replay', { ...mockHapcard, replay_id: 'replay-launch-smoke', jinjin_date: '2026-05-31' });
  await mockJson(page, '**/api/whatif/work', mockWhatif);
}

test.describe('launch core flow smoke', () => {
  test.beforeEach(async ({ page }) => {
    const pageErrors: string[] = [];
    runtimeErrors.set(page, pageErrors);
    page.on('pageerror', (error) => pageErrors.push(error.message));
  });

  test.afterEach(async ({ page }) => {
    expect(runtimeErrors.get(page) ?? []).toEqual([]);
  });

  test('guest onboarding completion reaches today guest view without live LLM cost', async ({ page }) => {
    await mockJson(page, '**/api/guest/today', { ok: true, card: mockDailyCard, chart: mockChart });
    await page.addInitScript(() => {
      window.localStorage.setItem('welcome_popup_seen_v1', '1');
      window.sessionStorage.setItem('osa_guest_legal_ready', '1');
      window.sessionStorage.setItem('onboarding-draft-v1', JSON.stringify({
        state: {
          nickname: '게스트',
          birthDate: '1995-11-12',
          calendar: 'solar',
          gender: 'F',
          knowledge: 'unknown',
          birthTime: '',
          tos: false,
        },
        version: 0,
      }));
    });

    await page.goto('/onboarding/review');
    await expect(page.getByRole('heading', { name: /입력한 정보를/ })).toBeVisible();
    await page.locator('main').getByRole('button', { name: '시작하기' }).click();
    await expect(page).toHaveURL(/\/today\/me$/);
    await expect(page.getByText('게스트님의 오늘을 먼저 볼게요.')).toBeVisible();
    await expectHealthyPage(page);
  });

  test('authenticated app flow covers relation create, feed, me wallet, hapcard replay, whatif, pay-per-use fail UX, and mocked 500 @auth', async ({ page }) => {
    test.setTimeout(60_000);

    await login(page);
    await installCoreMocks(page);
    await page.evaluate(() => window.localStorage.setItem('welcome_popup_seen_v1', '1'));

    await page.goto('/me');
    await expect(page.getByText('내 프로필', { exact: true })).toBeVisible();
    await expect(page.getByText('부적 지갑')).toBeVisible();
    await expect(page.getByRole('button', { name: '충전' })).toHaveCount(0);
    await expectHealthyPage(page);

    await page.evaluate(() => {
      window.localStorage.setItem('relations-draft-v1', JSON.stringify({
        state: {
          nickname: '테스트인연',
          gender: 'F',
          birthDate: '1996-02-03',
          calendar: 'solar',
          knowledge: 'unknown',
          birthTime: '',
          mode: '',
          consent: false,
        },
        version: 0,
      }));
    });
    await page.goto('/relations/new/mode');
    await page.getByRole('button', { name: /썸 관계/ }).click();
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: '등록하기' }).click();
    await expect(page).toHaveURL(/\/feed\?focus=relation-launch-smoke$/);
    await expect(page.getByRole('heading', { name: '케미피드' })).toBeVisible();
    await expect(page.getByText('테스트인연')).toBeVisible();
    await expectHealthyPage(page);

    await page.goto('/feed');
    await expect(page.getByText('오늘 변화 큼')).toBeVisible();
    await expect(page.getByText('테스트인연')).toBeVisible();
    await expectHealthyPage(page);

    await page.goto('/hapcard/relation-launch-smoke?mode=%EC%8D%B8%ED%95%A9');
    await expect(page.getByTestId('hapcard-hero-main-text')).toBeVisible();
    await expect(page.getByRole('button', { name: /그럴리 없어! 다시/ })).toBeVisible();
    await page.getByRole('button', { name: /그럴리 없어! 다시/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    // Replay paid-use UX smoke: server code owns refund_tokens_once/idempotency and pay-per-use unlocks.
    await page.getByRole('button', { name: '케미 다시 맞추기' }).click();
    await expect(page.getByText('재해석 완료. 흐름이 갱신되었어요.')).toBeVisible();
    await expectHealthyPage(page);

    await page.goto('/whatif/work');
    await expect(page.getByTestId('whatif-view')).toBeVisible();
    await expect(page.getByText('키워드')).toBeVisible();
    await expectHealthyPage(page);

    await page.goto('/payments/fail?code=CANCELED&message=launch%20cancel%20smoke');
    await expect(page.getByText('CANCELED')).toBeVisible();
    await expect(page.getByRole('link', { name: '케미피드로' })).toBeVisible();
    await expectHealthyPage(page);

    await mockJson(page, '**/api/launch-smoke/server-500', { error: { code: 'INTERNAL_ERROR', message: 'internal error launch smoke' } }, 500);
    const response = await page.goto('/api/launch-smoke/server-500');
    expect(response?.status()).toBe(500);
    await expect(page.getByText(/INTERNAL_ERROR|internal error/i)).toBeVisible();
  });
});
