import Link from 'next/link';

import { LegalMarkdown } from '@/components/legal/legal-markdown';
import { getLegalDocument, type LegalDocumentSlug } from '@/lib/legal/documents';

export async function LegalDocumentPage({ slug }: { slug: LegalDocumentSlug }) {
  const document = await getLegalDocument(slug);

  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <article className="mx-auto max-w-3xl rounded-[var(--r-md)] bg-card p-5 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-border pb-4">
          <Link href="/" className="text-sm font-bold text-primary">
            오늘케미
          </Link>
          <span className="text-xs text-muted-foreground">시행일 {document.version}</span>
        </div>
        <LegalMarkdown markdown={document.markdown} />
      </article>
    </main>
  );
}
