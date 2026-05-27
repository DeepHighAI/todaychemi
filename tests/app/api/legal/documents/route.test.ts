import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/legal/documents', () => ({
  getLegalDocument: vi.fn().mockResolvedValue({
    slug: 'terms',
    title: '이용약관',
    version: '2026-06-01',
    markdown: '# 오늘사이 서비스 이용약관',
  }),
}));

import { getLegalDocument } from '@/lib/legal/documents';
import { GET } from '@/app/api/legal/documents/[slug]/route';

describe('GET /api/legal/documents/[slug]', () => {
  it('returns a public legal document for layer popups', async () => {
    const res = await GET(new Request('https://hap.plae/api/legal/documents/terms') as never, {
      params: Promise.resolve({ slug: 'terms' }),
    });

    expect(res.status).toBe(200);
    expect(getLegalDocument).toHaveBeenCalledWith('terms');
    await expect(res.json()).resolves.toEqual({
      slug: 'terms',
      title: '이용약관',
      version: '2026-06-01',
      markdown: '# 오늘사이 서비스 이용약관',
    });
  });

  it('404 for unsupported legal document slugs', async () => {
    const res = await GET(new Request('https://hap.plae/api/legal/documents/refund') as never, {
      params: Promise.resolve({ slug: 'refund' }),
    });

    expect(res.status).toBe(404);
    expect(getLegalDocument).not.toHaveBeenCalledWith('refund');
  });
});
