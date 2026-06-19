import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, apiFetch, resolveApiBaseUrl } from './client';
import { setReauthHandler, __resetReauthForTest } from '@/lib/auth/reauth';

const PROD_HOST = 'https://todaychemi.vercel.app';

function mockFetchOnce(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    } as Response),
  );
}

/** 호출 순서대로 다른 응답을 주는 fetch mock (재시도 검증용). */
function mockFetchSequence(responses: Array<{ status: number; body: unknown }>) {
  const fn = vi.fn();
  responses.forEach((r) =>
    fn.mockResolvedValueOnce({
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      json: () => Promise.resolve(r.body),
    } as Response),
  );
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  __resetReauthForTest();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('apiFetch', () => {
  it('파싱: 정상 응답 JSON 을 반환한다', async () => {
    mockFetchOnce(200, { ok: true, value: 42 });
    const res = await apiFetch<{ ok: boolean; value: number }>('/api/x');
    expect(res).toEqual({ ok: true, value: 42 });
  });

  it('중첩 에러 봉투 { error: { code, message } } 를 ApiError 로 변환한다', async () => {
    mockFetchOnce(404, { error: { code: 'HAPCARD_NOT_FOUND', message: 'not found' } });
    await expect(apiFetch('/api/x')).rejects.toMatchObject({
      status: 404,
      code: 'HAPCARD_NOT_FOUND',
    });
  });

  it('402 PAYMENT_REQUIRED 시 ApiError.payment 에 { feature, ref, amount_krw } 를 채운다', async () => {
    mockFetchOnce(402, {
      error: { code: 'PAYMENT_REQUIRED', message: 'payment required' },
      feature: 'hapcard',
      ref: 'cache-key-abc',
      amount_krw: 1000,
    });

    let thrown: unknown;
    try {
      await apiFetch('/api/hapcards', { method: 'POST', body: {} });
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(ApiError);
    const err = thrown as ApiError;
    expect(err.status).toBe(402);
    expect(err.code).toBe('PAYMENT_REQUIRED');
    // 이 payload 가 IAP 결제 시트(payInfo)를 활성화한다 — 비면 결제 버튼이 비활성된다.
    expect(err.payment).toEqual({ feature: 'hapcard', ref: 'cache-key-abc', amount_krw: 1000 });
  });

  it('token 이 있으면 Authorization Bearer 헤더를 첨부한다', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    } as Response);
    vi.stubGlobal('fetch', fetchSpy);

    await apiFetch('/api/me', { token: 'tok-123' });

    const [, init] = fetchSpy.mock.calls[0];
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer tok-123');
  });
});

describe('apiFetch — 401 만료 토큰 자동 재로그인 재시도', () => {
  it('token + 401 → 재로그인 후 새 토큰으로 1회 재시도해 성공한다', async () => {
    setReauthHandler(async () => 'fresh-token');
    const fetchSpy = mockFetchSequence([
      { status: 401, body: { error: { code: 'UNAUTHORIZED' } } },
      { status: 200, body: { ok: true } },
    ]);

    const res = await apiFetch('/api/today', { token: 'stale' });

    expect(res).toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const [, init2] = fetchSpy.mock.calls[1];
    expect((init2.headers as Record<string, string>)['Authorization']).toBe('Bearer fresh-token');
  });

  it('token 없는 401 → 재로그인 미발화, 그대로 throw', async () => {
    const handler = vi.fn(async () => 'fresh');
    setReauthHandler(handler);
    const fetchSpy = mockFetchSequence([{ status: 401, body: { error: { code: 'UNAUTHORIZED' } } }]);

    await expect(apiFetch('/api/today')).rejects.toMatchObject({ status: 401 });
    expect(handler).not.toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('재시도 후에도 401 → throw (무한 루프 없음, fetch 정확히 2회)', async () => {
    setReauthHandler(async () => 'fresh-token');
    const fetchSpy = mockFetchSequence([
      { status: 401, body: { error: { code: 'UNAUTHORIZED' } } },
      { status: 401, body: { error: { code: 'UNAUTHORIZED' } } },
    ]);

    await expect(apiFetch('/api/today', { token: 'stale' })).rejects.toMatchObject({ status: 401 });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('재로그인이 null/동일 토큰을 주면 재시도하지 않는다', async () => {
    setReauthHandler(async () => null);
    const fetchSpy = mockFetchSequence([{ status: 401, body: { error: { code: 'UNAUTHORIZED' } } }]);

    await expect(apiFetch('/api/today', { token: 'stale' })).rejects.toMatchObject({ status: 401 });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('402 결제 필요는 재로그인 미발화', async () => {
    const handler = vi.fn(async () => 'fresh');
    setReauthHandler(handler);
    mockFetchSequence([
      {
        status: 402,
        body: { error: { code: 'PAYMENT_REQUIRED' }, feature: 'hapcard', ref: 'r', amount_krw: 550 },
      },
    ]);

    await expect(
      apiFetch('/api/hapcards', { token: 'tok', method: 'POST', body: {} }),
    ).rejects.toMatchObject({ status: 402 });
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('resolveApiBaseUrl', () => {
  it('명시값이 있으면 PROD 여부와 무관하게 그대로 사용', () => {
    expect(resolveApiBaseUrl({ VITE_API_BASE_URL: 'https://x.example', PROD: true })).toBe('https://x.example');
    expect(resolveApiBaseUrl({ VITE_API_BASE_URL: 'https://x.example', PROD: false })).toBe('https://x.example');
  });

  it('빈 문자열 + PROD → 프로덕션 호스트 (실기기 로그인 실패 회귀 차단)', () => {
    expect(resolveApiBaseUrl({ VITE_API_BASE_URL: '', PROD: true })).toBe(PROD_HOST);
  });

  it('미설정 + PROD → 프로덕션 호스트', () => {
    expect(resolveApiBaseUrl({ PROD: true })).toBe(PROD_HOST);
  });

  it('빈 문자열 + dev → 빈 base (상대경로 → vite 프록시)', () => {
    expect(resolveApiBaseUrl({ VITE_API_BASE_URL: '', PROD: false })).toBe('');
  });

  it('공백만 있는 값 → trim 후 PROD 폴백', () => {
    expect(resolveApiBaseUrl({ VITE_API_BASE_URL: '   ', PROD: true })).toBe(PROD_HOST);
  });
});
