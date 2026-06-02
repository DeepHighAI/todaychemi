import { describe, expect, it } from 'vitest';
import { apiErrorResponse, paymentRequiredResponse } from '@/lib/errors/route-response';

describe('apiErrorResponse', () => {
  it('returns JSON with {error:{code,message}} envelope and given status', async () => {
    const res = apiErrorResponse('UNAUTHORIZED', '인증 필요', 401);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: { code: 'UNAUTHORIZED', message: '인증 필요' } });
  });

  it('defaults message to empty string', async () => {
    const res = apiErrorResponse('INTERNAL_ERROR', undefined, 500);
    const body = await res.json();
    expect(body.error.message).toBe('');
  });

  it('sets Content-Type application/json', () => {
    const res = apiErrorResponse('NOT_FOUND', '', 404);
    expect(res.headers.get('content-type')).toContain('application/json');
  });
});

describe('paymentRequiredResponse (pay-per-use 402, ADR-039)', () => {
  it('returns 402 with PAYMENT_REQUIRED envelope + top-level pay-sheet fields', async () => {
    const res = paymentRequiredResponse('hapcard', 'cache-key-abc', 800);
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error.code).toBe('PAYMENT_REQUIRED');
    expect(typeof body.error.message).toBe('string');
    expect(body.feature).toBe('hapcard');
    expect(body.ref).toBe('cache-key-abc');
    expect(body.amount_krw).toBe(800);
  });

  it('keeps body.error intact (not shadowed) for ErrorCard mapping', async () => {
    const res = paymentRequiredResponse('replay', 'replay:hap-1:2026-06-02', 400);
    const body = await res.json();
    expect(body.error).toEqual({ code: 'PAYMENT_REQUIRED', message: expect.any(String) });
    expect(body.amount_krw).toBe(400);
  });

  it('sets Content-Type application/json', () => {
    const res = paymentRequiredResponse('whatif', 'ref-x', 500);
    expect(res.headers.get('content-type')).toContain('application/json');
  });
});
