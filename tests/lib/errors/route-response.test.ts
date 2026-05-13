import { describe, expect, it } from 'vitest';
import { apiErrorResponse } from '@/lib/errors/route-response';

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
