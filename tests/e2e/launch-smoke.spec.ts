import { expect, test, type Page } from '@playwright/test';

const FRAMEWORK_ERROR_TEXT = [
  'Unhandled Runtime Error',
  'Application error',
  'Hydration failed',
  'This page could not be found',
];

const runtimeErrors = new WeakMap<Page, string[]>();

async function expectNoFrameworkOverlay(page: Page) {
  for (const text of FRAMEWORK_ERROR_TEXT) {
    await expect(page.getByText(text, { exact: false })).toHaveCount(0);
  }
}

async function expectHealthyPage(page: Page) {
  await expect(page.locator('body')).not.toBeEmpty();
  await expectNoFrameworkOverlay(page);
}

test.describe('launch public smoke', () => {
  test.beforeEach(async ({ page }) => {
    const pageErrors: string[] = [];
    runtimeErrors.set(page, pageErrors);
    page.on('pageerror', (error) => pageErrors.push(error.message));

    test.info().annotations.push({
      type: 'runtime-errors',
      description: JSON.stringify(pageErrors),
    });
  });

  test.afterEach(async ({ page }) => {
    expect(runtimeErrors.get(page) ?? []).toEqual([]);
  });

  test('unauthenticated home redirects to start and login is reachable', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/start$/);
    await expect(page.getByText('오늘사이')).toBeVisible();
    await expect(page.getByRole('link', { name: /기존 계정으로 바로 로그인/ })).toBeVisible();
    await expectHealthyPage(page);

    await page.getByRole('link', { name: /기존 계정으로 바로 로그인/ }).click();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('textbox', { name: /이메일/ })).toBeVisible();
    await expectHealthyPage(page);
  });

  test('signup and legal pages render without app shell crashes', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByRole('textbox', { name: /이메일/ })).toBeVisible();
    await expectHealthyPage(page);

    await page.goto('/legal/privacy');
    await expect(page.locator('h1').filter({ hasText: '오늘사이 개인정보 처리방침' })).toBeVisible();
    await expectHealthyPage(page);

    await page.goto('/legal/refund');
    await expect(page.locator('h1').filter({ hasText: '환불 정책' })).toBeVisible();
    await expectHealthyPage(page);
  });

  test('payment charge login gate and invalid auth callback fail safely', async ({ page }) => {
    await page.goto('/payments/charge');
    await expect(page.getByText('로그인이 필요해요')).toBeVisible();
    await expect(page.getByRole('button', { name: '로그인하고 충전' })).toBeVisible();
    await expectHealthyPage(page);

    await page.getByRole('button', { name: '로그인하고 충전' }).click();
    await expect(page).toHaveURL(/\/login\?next=\/payments\/charge$/);
    await expectHealthyPage(page);

    await page.goto('/auth/callback');
    await expect(page).toHaveURL(/\/login\?error=auth_callback_failed/);
    await expectHealthyPage(page);
  });

  test('401 API and public OG share 404 fail safely', async ({ page }) => {
    const meResponse = await page.request.get('/api/me');
    expect(meResponse.status()).toBe(401);
    expect(await meResponse.json()).toEqual({
      error: { code: 'UNAUTHORIZED', message: '' },
    });

    const ogResponse = await page.request.get('/api/og/share/missing-launch-token');
    expect(ogResponse.status()).toBe(404);
    expect(await ogResponse.text()).toBe('share not found');
  });

  test('custom 404 page renders without framework overlay', async ({ page }) => {
    const response = await page.goto('/missing-launch-smoke-route');

    expect(response?.status()).toBe(404);
    await expect(page.getByText('페이지를 찾을 수 없어요.')).toBeVisible();
    await expect(page.getByRole('button', { name: '피드로 돌아가기' })).toBeVisible();
    await expectHealthyPage(page);
  });

  test('payment fail page renders INTERNAL_ERROR 500 internal error UX safely', async ({ page }) => {
    const response = await page.goto('/payments/fail?code=INTERNAL_ERROR&message=500%20internal%20error%20launch%20smoke');

    expect(response?.status()).toBe(200);
    await expect(page.getByText('INTERNAL_ERROR')).toBeVisible();
    await expect(page.getByText('500 internal error launch smoke')).toBeVisible();
    await expect(page.getByRole('link', { name: '다시 충전' })).toHaveAttribute('href', '/payments/charge');
    await expectHealthyPage(page);
  });
});
