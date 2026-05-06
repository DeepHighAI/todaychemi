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
  it('og:image URL contains hapcard id and range', async () => {
    const result = await generateMetadata({
      params: Promise.resolve({ id: 'hap-test-001' }),
      searchParams: Promise.resolve({ range: 'nickname-ohaeng' }),
    });
    const images = (result.openGraph?.images ?? []) as { url: string }[];
    expect(images[0].url).toContain('hap-test-001');
    expect(images[0].url).toContain('range=nickname-ohaeng');
  });

  it('defaults range to nickname-only when absent', async () => {
    const result = await generateMetadata({
      params: Promise.resolve({ id: 'hap-test-002' }),
      searchParams: Promise.resolve({}),
    });
    const images = (result.openGraph?.images ?? []) as { url: string }[];
    expect(images[0].url).toContain('range=nickname-only');
  });

  it('twitter card is summary_large_image', async () => {
    const result = await generateMetadata({
      params: Promise.resolve({ id: 'hap-test-003' }),
      searchParams: Promise.resolve({}),
    });
    const twitter = result.twitter as { card?: string } | undefined;
    expect(twitter?.card).toBe('summary_large_image');
  });

  it('og image dimensions are 1200x630', async () => {
    const result = await generateMetadata({
      params: Promise.resolve({ id: 'hap-test-004' }),
      searchParams: Promise.resolve({}),
    });
    const images = (result.openGraph?.images ?? []) as { url: string; width: number; height: number }[];
    expect(images[0].width).toBe(1200);
    expect(images[0].height).toBe(630);
  });
});
