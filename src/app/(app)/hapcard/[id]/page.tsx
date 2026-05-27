import type { Metadata } from 'next';

import { getAppOrigin } from '@/lib/app-url';

import HapcardView from './HapcardView';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string; mode?: string }>;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { id } = await params;
  const sp = await searchParams;
  const range = sp.range ?? 'nickname-only';
  const baseUrl = getAppOrigin();
  return {
    openGraph: {
      images: [{ url: `${baseUrl}/api/og/hapcard/${id}?range=${range}`, width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image' },
  };
}

export default function Page() {
  return <HapcardView />;
}
