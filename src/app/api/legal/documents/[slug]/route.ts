import { NextResponse, type NextRequest } from 'next/server';

import { getLegalDocument, type LegalDocumentSlug } from '@/lib/legal/documents';

// refund: 앱인토스 미니앱(유료 IAP) 검수 요건 — 환불 정책 인앱 노출용 (P6).
const ALLOWED_SLUGS = new Set<LegalDocumentSlug>(['terms', 'privacy', 'refund']);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!ALLOWED_SLUGS.has(slug as LegalDocumentSlug)) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const document = await getLegalDocument(slug as LegalDocumentSlug);
  return NextResponse.json(document);
}
