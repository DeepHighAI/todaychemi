import type { SupabaseClient } from '@supabase/supabase-js';
import { cache } from 'react';

import { buildOgPayload, type OgPayload } from '@/lib/og/render-payload';
import { buildPublicShareUrls } from '@/lib/share/build-share-payload';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import type { Database } from '@/types/database.types';

import type { ShareRange } from './schema';
import { hashShareToken } from './token';

type ServiceClient = SupabaseClient<Database>;

export interface PublicShare {
  share_id: string;
  user_id: string;
  hapcard_id: string;
  relation_id: string;
  range: ShareRange;
  title: string;
  text: string;
  url: string;
  og_image_url: string;
  mode: string;
  compat_score: number;
  nickname: string;
  gender_normalized: 'F' | 'M';
  ohaeng_counts?: Record<string, number>;
}

export async function getPublicShareByToken(
  token: string,
  serviceClient: ServiceClient = createServiceRoleClient(),
  origin = process.env.NEXT_PUBLIC_APP_URL ?? 'https://hap.plae',
): Promise<PublicShare | null> {
  const tokenHash = hashShareToken(token);
  const now = new Date().toISOString();

  const { data: shareRow, error: shareError } = await serviceClient
    .from('hapcard_shares')
    .select('share_id,user_id,hapcard_id,relation_id,range,title,message_text,expires_at,revoked_at')
    .eq('token_hash', tokenHash)
    .is('revoked_at', null)
    .gt('expires_at', now)
    .maybeSingle();

  if (shareError || !shareRow) return null;

  const share = shareRow as {
    share_id: string;
    user_id: string;
    hapcard_id: string;
    relation_id: string;
    range: ShareRange;
    title: string;
    message_text: string;
  };

  const { data: hapcardRow, error: hapcardError } = await serviceClient
    .from('hapcards')
    .select('hapcard_id,mode,compat_score,relation_id')
    .eq('hapcard_id', share.hapcard_id)
    .maybeSingle();

  if (hapcardError || !hapcardRow) return null;

  const hapcard = hapcardRow as {
    hapcard_id: string;
    mode: string;
    compat_score: number;
    relation_id: string;
  };

  const { data: relationRow, error: relationError } = await serviceClient
    .from('relations')
    .select('nickname,gender')
    .eq('relation_id', share.relation_id)
    .maybeSingle();

  if (relationError || !relationRow) return null;

  const relation = relationRow as { nickname?: string | null; gender?: string | null };
  let ohaengCounts: Record<string, number> | undefined;

  if (share.range === 'nickname-ohaeng') {
    const { data: chartRow } = await serviceClient
      .from('relation_charts')
      .select('chart_core')
      .eq('relation_id', share.relation_id)
      .maybeSingle();

    const chart = chartRow as { chart_core?: { five_elements_counts?: Record<string, number> } } | null;
    ohaengCounts = chart?.chart_core?.five_elements_counts;
  }

  const urls = buildPublicShareUrls(origin, token);

  return {
    share_id: share.share_id,
    user_id: share.user_id,
    hapcard_id: share.hapcard_id,
    relation_id: share.relation_id,
    range: share.range,
    title: share.title,
    text: share.message_text,
    url: urls.url,
    og_image_url: urls.og_image_url,
    mode: hapcard.mode,
    compat_score: hapcard.compat_score,
    nickname: relation.nickname ?? '인연',
    gender_normalized: relation.gender === 'M' ? 'M' : 'F',
    ohaeng_counts: ohaengCounts,
  };
}

export const getCachedPublicShareByToken = cache(getPublicShareByToken);

export function buildPublicShareOgPayload(share: PublicShare): OgPayload {
  return buildOgPayload(
    {
      nickname: share.nickname,
      score: share.compat_score,
      mode: share.mode,
      ohaeng_counts: share.ohaeng_counts,
      gender_normalized: share.gender_normalized,
    },
    share.range,
  );
}
