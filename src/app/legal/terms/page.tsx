import type { Metadata } from 'next';

import { LegalDocumentPage } from '../_components/legal-document-page';

export const metadata: Metadata = {
  title: '이용약관 | 오늘사이',
};

export default async function TermsPage() {
  return LegalDocumentPage({ slug: 'terms' });
}
