import { ImageResponse } from 'next/og';

import { createClient as createServerClient } from '@/lib/supabase/server';
import { sanitizeErrorForLog } from '@/lib/errors/sanitize-log';
import { loadNotoSansKrRegularFont } from '@/lib/og/font';
import { buildOgPayload } from '@/lib/og/render-payload';
import { OgTemplate } from '@/lib/og/template';
import type { ShareRange } from '@/lib/share/build-share-payload';

const VALID_RANGES: ShareRange[] = ['nickname-only', 'nickname-ohaeng', 'nickname-gender'];

function isValidRange(value: string | null): value is ShareRange {
  return value !== null && (VALID_RANGES as string[]).includes(value);
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, ctx: RouteContext): Promise<Response> {
  try {
    const url = new URL(request.url);
    const range = url.searchParams.get('range');

    if (!isValidRange(range)) {
      return new Response('invalid range', { status: 400 });
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
      .select('hapcard_id, mode, compat_score, relation_id')
      .eq('hapcard_id', id)
      .maybeSingle();

    if (!hapcardRow) {
      return new Response('hapcard not found', { status: 404 });
    }

    const hap = hapcardRow as { hapcard_id: string; mode: string; compat_score: number; relation_id: string };

    const { data: relRow } = await supabase
      .from('relations')
      .select('nickname, gender')
      .eq('relation_id', hap.relation_id)
      .maybeSingle();
    const rel = (relRow ?? { nickname: '인연', gender: 'F' }) as {
      nickname: string;
      gender: string;
    };

    let ohaengCounts: Record<string, number> | undefined;
    if (range === 'nickname-ohaeng') {
      const { data: chartRow } = await supabase
        .from('relation_charts')
        .select('chart_core')
        .eq('relation_id', hap.relation_id)
        .maybeSingle();
      const chart = chartRow as { chart_core: { five_elements_counts?: Record<string, number> } } | null;
      ohaengCounts = chart?.chart_core?.five_elements_counts;
    }

    const payload = buildOgPayload(
      {
        nickname: rel.nickname,
        score: hap.compat_score,
        mode: hap.mode,
        ohaeng_counts: ohaengCounts,
        gender_normalized: rel.gender === 'M' ? 'M' : 'F',
      },
      range,
    );

    // Satori 기본 폰트(Geist)는 Latin-only — Hangul 렌더링을 위해 Noto Sans KR 등록
    const fontData = await loadNotoSansKrRegularFont(request.url);

    return new ImageResponse(<OgTemplate payload={payload} />, {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: 'Noto Sans KR',
          data: fontData,
          style: 'normal',
          weight: 400,
        },
      ],
    });
  } catch (err) {
    console.error('[og/hapcard] 렌더 오류:', { error: sanitizeErrorForLog(err) });
    return new Response('internal error', { status: 500 });
  }
}

export const runtime = 'edge';
