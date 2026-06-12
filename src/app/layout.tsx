import type { Metadata } from 'next';
import { Suspense } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';

import './globals.css';
import Providers from './providers';
import { GaScript } from '@/components/analytics/ga-script';
import { GaPageView } from '@/components/analytics/ga-page-view';
import { GaPurchaseTracker } from '@/components/analytics/ga-purchase-tracker';

export const metadata: Metadata = {
  title: '오늘케미 — 우리 사이, 오늘 케미는?',
  description:
    '오늘 만나는 사람과의 흐름을 미리 확인해봐. 별명만으로 인연을 등록하고 오늘의 케미를 확인합니다.',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className="h-full"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
        {/* G-8: GA4 — env 부재 시 전부 no-op. useSearchParams 사용 컴포넌트는 Suspense 의무 */}
        <GaScript />
        <Suspense fallback={null}>
          <GaPageView />
          <GaPurchaseTracker />
        </Suspense>
      </body>
    </html>
  );
}
