import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';

import { getCachedPublicShareByToken } from '@/lib/share/public-share';

interface Props {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const share = await getCachedPublicShareByToken(token);
  if (!share) return {};

  return {
    title: share.title,
    description: share.text,
    openGraph: {
      title: share.title,
      description: share.text,
      images: [{ url: share.og_image_url, width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image' },
  };
}

export default async function PublicHapcardSharePage({ params }: Props) {
  const { token } = await params;
  const share = await getCachedPublicShareByToken(token);
  if (!share) notFound();

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center gap-5">
        <Image
          src={share.og_image_url}
          alt={share.title}
          width={1200}
          height={630}
          unoptimized
          className="aspect-[1200/630] w-full rounded-[var(--r-xl)] border border-border bg-card object-cover shadow-[var(--e-2)]"
        />
        <div className="space-y-3">
          <p className="font-eyebrow text-primary">{share.mode}</p>
          <h1 className="font-h1 text-foreground">{share.title}</h1>
          <p className="font-sub text-muted-foreground">{share.text}</p>
        </div>
        <a
          href="/login"
          className="inline-flex h-12 items-center justify-center rounded-[var(--r-pill)] bg-primary px-5 text-sm font-bold text-primary-foreground active:translate-y-px"
        >
          오늘케미에서 보기
        </a>
      </section>
    </main>
  );
}
