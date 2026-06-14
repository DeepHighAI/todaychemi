import { describe, expect, it, vi } from 'vitest';

import { buildPublicShareOgPayload, getPublicShareByToken } from '@/lib/share/public-share';
import type { ShareRange } from '@/lib/share/schema';

const HAPCARD_ID = '550e8400-e29b-41d4-a716-446655440000';
const USER_ID = '550e8400-e29b-41d4-a716-446655440099';
const RELATION_ID = '550e8400-e29b-41d4-a716-446655440088';

function makeServiceClient(opts: { shareMissing?: boolean; omitAreaScores?: boolean; range?: ShareRange } = {}) {
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
                          range: opts.range ?? 'nickname-only',
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
                  score_breakdown: {
                    hap_chung_hyung_hae: 70,
                    sipsin: 75,
                    ohaeng: 68,
                    yunse_adjustment: 3,
                    mode_adjustment: 5,
                  },
                  relation_id: RELATION_ID,
                  content: {
                    main_text: '결론 = 동료감이 큰 사이예요. 서로 배려가 깊어요.',
                    ...(opts.omitAreaScores
                      ? {}
                      : { area_scores: { talk: 80, attract: 74, speed: 62, money: 55, future: 68 } }),
                  },
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
              maybeSingle: () => Promise.resolve({
                data: { chart_core: { five_elements_counts: { 목: 3, 화: 1, 토: 2, 금: 1, 수: 1 } } },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'hapcard_score_snapshots') {
        const chain: Record<string, unknown> = {};
        let orderCalls = 0;
        chain.select = () => chain;
        chain.eq = () => chain;
        chain.order = () => {
          orderCalls++;
          if (orderCalls < 2) return chain;
          return Promise.resolve({
            data: [{ compat_score: 60 }, { compat_score: 70 }, { compat_score: 78 }],
            error: null,
          });
        };
        return chain;
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
    expect(share?.ohaeng_counts).toEqual({ 목: 3, 화: 1, 토: 2, 금: 1, 수: 1 });
    expect(share?.area_scores).toEqual({ talk: 80, attract: 74, speed: 62, money: 55, future: 68 });
    expect(share?.headline).toBe('동료감이 큰 사이예요');
    expect(share?.flow_scores).toEqual([60, 70, 78]);

    const keys = Object.keys(share ?? {});
    expect(keys).not.toContain('birth_date');
    expect(keys).not.toContain('name');
    expect(keys).not.toContain('email');
    expect(keys).not.toContain('birth_place');
    expect(keys).not.toContain('gender');
  });

  it('buildPublicShareOgPayload는 nickname-only 공개 토큰에서 확장 데이터를 노출하지 않는다', async () => {
    const share = await getPublicShareByToken(
      'share-token-001',
      makeServiceClient() as never,
      'https://hap.plae',
    );

    expect(share).not.toBeNull();
    const payload = buildPublicShareOgPayload(share!);
    expect(payload.layout).toBe('minimal');
    expect(payload.ohaeng_counts).toBeUndefined();
    expect(payload.area_scores).toBeUndefined();
    expect(payload.headline).toBeUndefined();
    expect(payload.flow_scores).toBeUndefined();
  });

  it('buildPublicShareOgPayload는 nickname-ohaeng 공개 토큰에서 오행까지만 노출한다', async () => {
    const share = await getPublicShareByToken(
      'share-token-001',
      makeServiceClient({ range: 'nickname-ohaeng' }) as never,
      'https://hap.plae',
    );

    expect(share).not.toBeNull();
    const payload = buildPublicShareOgPayload(share!);
    expect(payload.layout).toBe('ohaeng');
    expect(payload.ohaeng_counts).toEqual({ 목: 3, 화: 1, 토: 2, 금: 1, 수: 1 });
    expect(payload.area_scores).toBeUndefined();
    expect(payload.headline).toBeUndefined();
    expect(payload.flow_scores).toBeUndefined();
  });

  it('content.area_scores 없는 공개 공유도 score_breakdown 으로 영역 fallback 을 만든다', async () => {
    const share = await getPublicShareByToken(
      'share-token-001',
      makeServiceClient({ omitAreaScores: true }) as never,
      'https://hap.plae',
    );

    expect(share).not.toBeNull();
    expect(share?.area_scores).toEqual({
      talk: 76,
      attract: 74,
      speed: 87,
      money: 73,
      future: 74,
    });
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
