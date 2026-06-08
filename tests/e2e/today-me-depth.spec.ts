import { expect, test, type Page } from '@playwright/test';

/*
 * F6/F7 browser-integration depth E2E (@auth).
 *
 * The existing launch/core/auth smoke specs cover breadth across F0~F8, but two
 * authenticated screens were only ever asserted in jsdom unit tests, never in a
 * real browser: the Today home (`/`, F6) and the 내 사주맵 5 sections (`/me`, F7).
 * This spec drives the real Next.js shell (SSR + middleware + auth cookie) with
 * mocked JSON so no live LLM cost is incurred.
 *
 * Like the other @auth specs it needs a confirmed Supabase test user:
 *   pnpm seed:test-user   (or set E2E_AUTH_EMAIL/E2E_AUTH_PASSWORD)
 *   RUN_AUTH_E2E=1 pnpm e2e
 */

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

const mockProfile = {
  ok: true,
  profile: {
    nickname: '나',
    birth_date: '1991-03-15',
    birth_date_calendar: 'solar',
    is_lunar_leap: false,
    birth_time_knowledge: 'exact',
    birth_time: '14:30',
    gender: 'F',
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
  ledger: [],
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
  relation_id: 'relation-depth-smoke',
  relation_nickname: '테스트인연',
  today_compat_score: 72,
};

const mockFeedItems = [
  {
    relation_id: 'relation-depth-smoke',
    nickname: '테스트인연',
    mode: '썸합',
    compat_score: 76,
    change_score: 8,
    has_significant_change: true,
    created_at: '2026-05-31T00:00:00.000Z',
  },
];

function authCredentials() {
  return {
    email: process.env.E2E_AUTH_EMAIL ?? process.env.TEST_EMAIL ?? 'Test1@test.com',
    password: process.env.E2E_AUTH_PASSWORD ?? process.env.TEST_PASSWORD ?? 'test1234',
  };
}

async function expectHealthyPage(page: Page) {
  await expect(page.locator('body')).not.toBeEmpty();
  for (const text of FRAMEWORK_ERROR_TEXT) {
    await expect(page.getByText(text, { exact: false })).toHaveCount(0);
  }
}

async function waitForLoginSuccessOrError(page: Page): Promise<'success' | 'error'> {
  return Promise.race([
    page.waitForURL((url) => url.pathname === '/legal/privacy', { timeout: 10_000 }).then(() => 'success' as const),
    page
      .getByText('이메일 또는 비밀번호가 올바르지 않아요.')
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => 'error' as const),
  ]);
}

async function login(page: Page) {
  const { email, password } = authCredentials();
  await page.goto('/login?next=/legal/privacy');
  await page.getByRole('textbox', { name: /이메일/ }).fill(email);
  await page.getByLabel(/비밀번호/).fill(password);

  await page.getByRole('button', { name: /이메일로 로그인/ }).click();
  const firstAttempt = await waitForLoginSuccessOrError(page);
  if (firstAttempt === 'success') return;

  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /이메일로 로그인/ }).click();
  const secondAttempt = await waitForLoginSuccessOrError(page);
  if (secondAttempt === 'success') return;

  throw new Error('Seeded auth login failed. Run pnpm seed:test-user or set E2E_AUTH_EMAIL/E2E_AUTH_PASSWORD.');
}

async function mockJson(page: Page, url: string, body: unknown, status = 200) {
  await page.route(url, async (route) => {
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

async function installMeMocks(page: Page) {
  await mockJson(page, '**/api/rewards/session', { ok: true, reward: { reason: 'ALREADY_AWARDED' } });
  await mockJson(page, '**/api/today', { ok: true, card: mockDailyCard });
  await mockJson(page, '**/api/me', mockProfile);
  await mockJson(page, '**/api/me/chart', { ok: true, chart: mockChart });
  await mockJson(page, '**/api/me/wallet', mockWallet);
  await mockJson(page, '**/api/relations', { items: mockFeedItems });
  await mockJson(page, '**/api/feed', { items: mockFeedItems });
}

test.describe('today home + me chart depth @auth', () => {
  test.beforeEach(async ({ page }) => {
    const pageErrors: string[] = [];
    runtimeErrors.set(page, pageErrors);
    page.on('pageerror', (error) => pageErrors.push(error.message));
  });

  test.afterEach(async ({ page }) => {
    expect(runtimeErrors.get(page) ?? []).toEqual([]);
  });

  test('F6: authenticated today home renders the daily card, relation chip, and 케미온도 @auth', async ({ page }) => {
    test.setTimeout(60_000);

    await login(page);
    await installMeMocks(page);
    await page.evaluate(() => window.localStorage.setItem('welcome_popup_seen_v1', '1'));

    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: '오늘의 케미' })).toBeVisible();
    await expect(page.getByText('테스트인연').first()).toBeVisible();
    await expect(page.getByText('케미온도')).toBeVisible();
    await expect(page.getByText('서두르기보다 작은 약속을 확인하면 흐름이 안정돼요.')).toBeVisible();
    await expectHealthyPage(page);
  });

  test('F7: 내 사주맵 renders all five chart sections @auth', async ({ page }) => {
    test.setTimeout(60_000);

    await login(page);
    await installMeMocks(page);
    await page.evaluate(() => window.localStorage.setItem('welcome_popup_seen_v1', '1'));

    await page.goto('/me');
    await expect(page.getByText('내 프로필', { exact: true })).toBeVisible();
    await expect(page.getByTestId('me-hero')).toBeVisible();
    await expect(page.getByTestId('pillar-grid')).toBeVisible();
    await expect(page.getByTestId('day-master-card')).toBeVisible();
    await expect(page.getByTestId('yunse-card')).toBeVisible();
    await expect(page.getByTestId('talisman-card')).toBeVisible();
    await expectHealthyPage(page);
  });
});
