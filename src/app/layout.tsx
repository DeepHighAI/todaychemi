import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';

import './globals.css';
import Providers from './providers';

export const metadata: Metadata = {
  title: '오늘사이 (TWODAY) — 우리 오늘 무슨 사이야?',
  description:
    '오늘 만나는 사람과의 흐름을 미리 확인해봐. 별명만으로 인연을 등록하고 오늘의 사이를 확인합니다.',
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
      </body>
    </html>
  );
}
