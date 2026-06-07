import type { Metadata } from 'next';

import { LegalDocumentPage } from '../_components/legal-document-page';

export const metadata: Metadata = {
  title: '환불 정책 | 오늘케미',
};

export default async function RefundPage() {
  return LegalDocumentPage({ slug: 'refund' });
}
