'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

import { trackPageView } from '@/lib/analytics/ga';

// G-8: App Router SPA 내비게이션 page_view 수동 전송 (GaScript send_page_view:false 페어)
export function GaPageView() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname) trackPageView(pathname);
  }, [pathname]);

  return null;
}
