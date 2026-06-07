import type { Metadata } from 'next';

import { LegalDocumentPage } from '../_components/legal-document-page';

export const metadata: Metadata = {
  title: '개인정보처리방침 | 오늘케미',
};

export default async function PrivacyPage() {
  return LegalDocumentPage({ slug: 'privacy' });
}
