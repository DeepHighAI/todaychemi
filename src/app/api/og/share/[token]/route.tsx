import { ImageResponse } from 'next/og';

import { buildPublicShareOgPayload, getPublicShareByToken } from '@/lib/share/public-share';
import { loadNotoSansKrRegularFont } from '@/lib/og/font';
import { OgTemplate } from '@/lib/og/template';

interface RouteContext {
  params: Promise<{ token: string }>;
}

export async function GET(request: Request, ctx: RouteContext): Promise<Response> {
  try {
    const { token } = await ctx.params;
    const share = await getPublicShareByToken(token);
    if (!share) {
      return new Response('share not found', { status: 404 });
    }

    const payload = buildPublicShareOgPayload(share);
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
    console.error('[og/share] 렌더 오류:', err);
    return new Response('internal error', { status: 500 });
  }
}

export const runtime = 'nodejs';
