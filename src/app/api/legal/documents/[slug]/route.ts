import { NextResponse, type NextRequest } from 'next/server';

import { getLegalDocument, type LegalDocumentSlug } from '@/lib/legal/documents';

const ALLOWED_SLUGS = new Set<LegalDocumentSlug>(['terms', 'privacy']);

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
