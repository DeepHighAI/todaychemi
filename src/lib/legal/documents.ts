import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { LEGAL_PRIVACY_VERSION, LEGAL_TERMS_VERSION } from './consent';

export type LegalDocumentSlug = 'terms' | 'privacy' | 'refund';

interface LegalDocumentConfig {
  slug: LegalDocumentSlug;
  title: string;
  version: string;
  fileName: string;
}

const LEGAL_DOCUMENTS: Record<LegalDocumentSlug, LegalDocumentConfig> = {
  terms: {
    slug: 'terms',
    title: '이용약관',
    version: LEGAL_TERMS_VERSION,
    fileName: 'terms_of_service.md',
  },
  privacy: {
    slug: 'privacy',
    title: '개인정보처리방침',
    version: LEGAL_PRIVACY_VERSION,
    fileName: 'privacy_policy.md',
  },
  refund: {
    slug: 'refund',
    title: '환불 정책',
    version: LEGAL_TERMS_VERSION,
    fileName: 'refund_policy.md',
  },
};

export async function getLegalDocument(slug: LegalDocumentSlug) {
  const document = LEGAL_DOCUMENTS[slug];
  const markdown = await readFile(path.join(process.cwd(), 'docs', 'legal', document.fileName), 'utf8');
  return { ...document, markdown };
}
