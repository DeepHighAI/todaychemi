import { ImageResponse } from 'next/og';

import { createClient as createServerClient } from '@/lib/supabase/server';
import { sanitizeErrorForLog } from '@/lib/errors/sanitize-log';
import { loadNotoSansKrRegularFont } from '@/lib/og/font';
import {
  buildOgPayload,
  rangeToLayoutOptions,
  type OgPayloadInput,
  type OgPayloadOptions,
  type ShareLayout,
} from '@/lib/og/render-payload';
import { OgTemplate } from '@/lib/og/template';
import { extractShareHeadline } from '@/lib/share/headline';
import type { ShareRange } from '@/lib/share/build-share-payload';

const VALID_LAYOUTS: ShareLayout[] = ['minimal', 'ohaeng', 'radar', 'comment', 'flow'];
const VALID_RANGES: ShareRange[] = ['nickname-only', 'nickname-ohaeng', 'nickname-gender'];
const FLOW_MAX = 7;

function isValidLayout(value: string | null): value is ShareLayout {
  return value !== null && (VALID_LAYOUTS as string[]).includes(value);
}

function isValidRange(value: string | null): value is ShareRange {
  return value !== null && (VALID_RANGES as string[]).includes(value);
}

// layout 파라미터 우선, 없으면 레거시 range 매핑. 둘 다 무효면 null(400).
function resolveOptions(url: URL): OgPayloadOptions | null {
  const layout = url.searchParams.get('layout');
  if (layout !== null) {
    if (!isValidLayout(layout)) return null;
    return { layout, showGender: url.searchParams.get('gender') === '1' };
  }
  const range = url.searchParams.get('range');
  if (isValidRange(range)) return rangeToLayoutOptions(range);
  return null;
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, ctx: RouteContext): Promise<Response> {
  try {
    const url = new URL(request.url);
    const options = resolveOptions(url);
    if (!options) {
      return new Response('invalid layout', { status: 400 });
    }

    const { id } = await ctx.params;

    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new Response('unauthorized', { status: 401 });
    }

    const { data: hapcardRow } = await supabase
      .from('hapcards')
      .select('hapcard_id, mode, compat_score, relation_id, content')
      .eq('hapcard_id', id)
      .maybeSingle();

    if (!hapcardRow) {
      return new Response('hapcard not found', { status: 404 });
    }

    const hap = hapcardRow as {
      hapcard_id: string;
      mode: string;
      compat_score: number;
      relation_id: string;
      content?: { main_text?: string } | null;
    };

    const { data: relRow } = await supabase
      .from('relations')
      .select('nickname, gender')
      .eq('relation_id', hap.relation_id)
      .maybeSingle();
    const rel = (relRow ?? { nickname: '인연', gender: 'F' }) as { nickname: string; gender: string };

    const input: OgPayloadInput = {
      nickname: rel.nickname,
      score: hap.compat_score,
      mode: hap.mode,
      gender_normalized: rel.gender === 'M' ? 'M' : 'F',
    };

    // 레이아웃별 데이터 — 비-PII (오행 수치·나vs인연 오행·요약 코멘트·점수 흐름)
    if (options.layout === 'ohaeng') {
      input.ohaeng_counts = await loadOhaengCounts(supabase, hap.relation_id);
    } else if (options.layout === 'radar') {
      const [userCounts, relationCounts] = await Promise.all([
        loadUserOhaengCounts(supabase, user.id),
        loadOhaengCounts(supabase, hap.relation_id),
      ]);
      input.radar = { user: userCounts ?? {}, relation: relationCounts ?? {} };
    } else if (options.layout === 'comment') {
      input.headline = extractShareHeadline(hap.content?.main_text ?? '');
    } else if (options.layout === 'flow') {
      input.flow_scores = await loadFlowScores(supabase, hap.relation_id, hap.mode);
    }

    const payload = buildOgPayload(input, options);
    const fontData = await loadNotoSansKrRegularFont(request.url);

    return new ImageResponse(<OgTemplate payload={payload} />, {
      width: 1200,
      height: 630,
      fonts: [{ name: 'Noto Sans KR', data: fontData, style: 'normal', weight: 400 }],
    });
  } catch (err) {
    console.error('[og/hapcard] 렌더 오류:', { error: sanitizeErrorForLog(err) });
    return new Response('internal error', { status: 500 });
  }
}

async function loadOhaengCounts(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  relationId: string,
): Promise<Record<string, number> | undefined> {
  const { data } = await supabase
    .from('relation_charts')
    .select('chart_core')
    .eq('relation_id', relationId)
    .maybeSingle();
  const chart = data as { chart_core?: { five_elements_counts?: Record<string, number> } } | null;
  return chart?.chart_core?.five_elements_counts;
}

async function loadUserOhaengCounts(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  userId: string,
): Promise<Record<string, number> | undefined> {
  const { data } = await supabase
    .from('user_charts')
    .select('chart_core')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const chart = data as { chart_core?: { five_elements_counts?: Record<string, number> } } | null;
  return chart?.chart_core?.five_elements_counts;
}

async function loadFlowScores(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  relationId: string,
  mode: string,
): Promise<number[]> {
  const { data } = await supabase
    .from('hapcard_score_snapshots')
    .select('compat_score')
    .eq('relation_id', relationId)
    .eq('mode', mode)
    .order('target_date', { ascending: true })
    .order('created_at', { ascending: false });
  const rows = (data ?? []) as Array<{ compat_score: number }>;
  return rows.slice(-FLOW_MAX).map((r) => Number(r.compat_score));
}

export const runtime = 'edge';
