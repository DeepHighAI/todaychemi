import type { SupabaseClient } from '@supabase/supabase-js';
import { cache } from 'react';

import { getAppOrigin } from '@/lib/app-url';
import {
  buildOgPayload,
  deriveShareAreaScores,
  rangeToLayoutOptions,
  type OgPayload,
  type ShareAreaScores,
} from '@/lib/og/render-payload';
import { extractShareHeadline } from '@/lib/share/headline';
import { buildPublicShareUrls } from '@/lib/share/build-share-payload';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import type { Database } from '@/types/database.types';
import type { ScoreBreakdown } from '@/types/hapcard';

import type { ShareRange } from './schema';
import { hashShareToken } from './token';

type ServiceClient = SupabaseClient<Database>;
const FLOW_MAX = 7;

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
  area_scores?: ShareAreaScores;
  headline?: string;
  flow_scores?: number[];
}

export async function getPublicShareByToken(
  token: string,
  serviceClient: ServiceClient = createServiceRoleClient(),
  origin = getAppOrigin(),
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
    .select('hapcard_id,mode,compat_score,score_breakdown,relation_id,content')
    .eq('hapcard_id', share.hapcard_id)
    .maybeSingle();

  if (hapcardError || !hapcardRow) return null;

  const hapcard = hapcardRow as {
    hapcard_id: string;
    mode: string;
    compat_score: number;
    score_breakdown?: ScoreBreakdown | null;
    relation_id: string;
    content?: { main_text?: string; area_scores?: ShareAreaScores } | null;
  };

  const { data: relationRow, error: relationError } = await serviceClient
    .from('relations')
    .select('nickname,gender')
    .eq('relation_id', share.relation_id)
    .maybeSingle();

  if (relationError || !relationRow) return null;

  const relation = relationRow as { nickname?: string | null; gender?: string | null };
  const [ohaengCounts, flowScores] = await Promise.all([
    loadOhaengCounts(serviceClient, share.relation_id),
    loadFlowScores(serviceClient, share.relation_id, hapcard.mode),
  ]);

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
    area_scores: hapcard.content?.area_scores ?? deriveShareAreaScores(
      hapcard.compat_score,
      hapcard.score_breakdown,
      hapcard.mode,
    ),
    headline: extractShareHeadline(hapcard.content?.main_text ?? ''),
    flow_scores: flowScores,
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
      area_scores: share.area_scores,
      headline: share.headline,
      flow_scores: share.flow_scores,
      gender_normalized: share.gender_normalized,
    },
    rangeToLayoutOptions(share.range),
  );
}

async function loadOhaengCounts(
  serviceClient: ServiceClient,
  relationId: string,
): Promise<Record<string, number> | undefined> {
  const { data } = await serviceClient
    .from('relation_charts')
    .select('chart_core')
    .eq('relation_id', relationId)
    .maybeSingle();

  const chart = data as { chart_core?: { five_elements_counts?: Record<string, number> } } | null;
  return chart?.chart_core?.five_elements_counts;
}

async function loadFlowScores(
  serviceClient: ServiceClient,
  relationId: string,
  mode: string,
): Promise<number[]> {
  const { data } = await serviceClient
    .from('hapcard_score_snapshots')
    .select('compat_score')
    .eq('relation_id', relationId)
    .eq('mode', mode)
    .order('target_date', { ascending: true })
    .order('created_at', { ascending: false });

  const rows = (data ?? []) as Array<{ compat_score: number }>;
  return rows.slice(-FLOW_MAX).map((r) => Number(r.compat_score));
}
