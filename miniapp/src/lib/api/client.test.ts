import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, apiFetch } from './client';

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

afterEach(() => {
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
