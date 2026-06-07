import { describe, expect, it, vi } from 'vitest';

import { getPublicShareByToken } from '@/lib/share/public-share';

const HAPCARD_ID = '550e8400-e29b-41d4-a716-446655440000';
const USER_ID = '550e8400-e29b-41d4-a716-446655440099';
const RELATION_ID = '550e8400-e29b-41d4-a716-446655440088';

function makeServiceClient(opts: { shareMissing?: boolean } = {}) {
  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'hapcard_shares') {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                gt: () => ({
                  maybeSingle: () => Promise.resolve({
                    data: opts.shareMissing
                      ? null
                      : {
                          share_id: '550e8400-e29b-41d4-a716-446655440001',
                          user_id: USER_ID,
                          hapcard_id: HAPCARD_ID,
                          relation_id: RELATION_ID,
                          range: 'nickname-only',
                          title: '봄달님과의 친구 관계',
                          message_text: '봄달님과의 케미온도: 38.4°C · 오늘케미에서 확인해봐',
                        },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'hapcards') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({
                data: {
                  hapcard_id: HAPCARD_ID,
                  mode: '친구합',
                  compat_score: 78,
                  relation_id: RELATION_ID,
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'relations') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({
                data: { nickname: '봄달', gender: 'F' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'relation_charts') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  };
}

describe('getPublicShareByToken', () => {
  it('returns PII-safe public share data and reconstructs URLs without storing raw token', async () => {
    const share = await getPublicShareByToken(
      'share-token-001',
      makeServiceClient() as never,
      'https://hap.plae',
    );

    expect(share).not.toBeNull();
    expect(share?.url).toBe('https://hap.plae/h/share-token-001');
    expect(share?.og_image_url).toBe('https://hap.plae/api/og/share/share-token-001');
    expect(share?.url).not.toContain(HAPCARD_ID);

    const keys = Object.keys(share ?? {});
    expect(keys).not.toContain('birth_date');
    expect(keys).not.toContain('name');
    expect(keys).not.toContain('email');
    expect(keys).not.toContain('birth_place');
    expect(keys).not.toContain('gender');
  });

  it('returns null for expired, revoked, or unknown token', async () => {
    const share = await getPublicShareByToken(
      'missing-token',
      makeServiceClient({ shareMissing: true }) as never,
      'https://hap.plae',
    );

    expect(share).toBeNull();
  });
});
