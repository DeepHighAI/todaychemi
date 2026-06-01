import { expect, test, type Page } from '@playwright/test';

const FRAMEWORK_ERROR_TEXT = [
  'Unhandled Runtime Error',
  'Application error',
  'Hydration failed',
  'This page could not be found',
];

const runtimeErrors = new WeakMap<Page, string[]>();

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

  throw new Error('Seeded auth smoke login failed after retry. Run pnpm seed:test-user or set E2E_AUTH_EMAIL/E2E_AUTH_PASSWORD for a confirmed QA account.');
}

test.describe('launch authenticated smoke @auth', () => {
  test.beforeEach(async ({ page }) => {
    const pageErrors: string[] = [];
    runtimeErrors.set(page, pageErrors);
    page.on('pageerror', (error) => pageErrors.push(error.message));
  });

  test.afterEach(async ({ page }) => {
    expect(runtimeErrors.get(page) ?? []).toEqual([]);
  });

  test('seeded signup/login account reaches authenticated APIs @auth', async ({ page }) => {
    const { email, password } = authCredentials();

    await page.goto('/signup');
    await expect(page.getByRole('textbox', { name: /이메일/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /로그인/ })).toHaveAttribute('href', '/login');
    await expectHealthyPage(page);

    await page.goto('/login?next=/legal/privacy');
    await page.getByRole('textbox', { name: /이메일/ }).fill(email);
    await page.getByLabel(/비밀번호/).fill(password);
    await submitEmailLogin(page);
    await expect(page.locator('h1').filter({ hasText: '오늘사이 개인정보 처리방침' })).toBeVisible();
    await expectHealthyPage(page);

    const meResponse = await page.request.get('/api/me');
    expect(meResponse.status()).toBe(200);
    const meBody = await meResponse.json();
    expect(meBody.ok).toBe(true);

    const walletResponse = await page.request.get('/api/me/wallet');
    expect(walletResponse.status()).toBe(200);
    const walletBody = await walletResponse.json();
    expect(walletBody.ok).toBe(true);
  });
});
