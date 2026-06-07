import { beforeAll, describe, expect, it } from 'vitest';
import type { Metadata } from 'next';

type GenerateMetadata = (props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string; mode?: string }>;
}) => Promise<Metadata>;

let generateMetadata: GenerateMetadata;

beforeAll(async () => {
  const mod = await import('@/app/(app)/hapcard/[id]/page');
  generateMetadata = mod.generateMetadata as GenerateMetadata;
});

describe('generateMetadata — hapcard page', () => {
  it('does not build hapcard OG image URL from the relation route id', async () => {
    const result = await generateMetadata({
      params: Promise.resolve({ id: 'rel-test-001' }),
      searchParams: Promise.resolve({ range: 'nickname-ohaeng' }),
    });
    expect(result.openGraph?.images ?? []).toEqual([]);
    expect(result.twitter).toBeUndefined();
  });
});
