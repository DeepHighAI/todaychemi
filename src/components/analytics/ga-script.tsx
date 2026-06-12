import Script from 'next/script';

import { gaMeasurementId } from '@/lib/analytics/ga';

// G-8: GA4 gtag 로더 — env 부재 시 렌더 0 (no-op).
// send_page_view:false — App Router SPA 내비게이션은 GaPageView 가 수동 전송
export function GaScript() {
  const id = gaMeasurementId();
  if (!id) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('js', new Date());
gtag('config', '${id}', { send_page_view: false });`}
      </Script>
    </>
  );
}
