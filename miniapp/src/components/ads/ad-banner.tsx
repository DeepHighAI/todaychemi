/**
 * ad-banner.tsx — 앱인토스 인앱 배너 광고 (항목 4)
 *
 * 토스 WebView SDK `TossAds.attachBanner` 로 리스트형 배너를 부착한다.
 * - 토스앱 5.241.0 미만/웹 dev 등 미지원 환경: `isSupported()` false → 아무것도 렌더하지 않음(빈 화면 방지).
 * - 광고 그룹 ID: env `VITE_TOSS_AD_GROUP_ID`(dev 미설정 시에만 테스트 ID `ait-ad-test-banner-id`).
 * - 컨테이너 내부는 비워둬야 하며(SDK 가 DOM 주입), width 100% + 고정 높이 96px.
 *
 * 토스 정책: 결제/인증 흐름에는 광고 금지, 다른 UI 와 겹치지 않게, SDK 기본 동작 변조 금지.
 * 초기화는 컴포넌트별 호출(SDK 가 중복 초기화를 자동 무시).
 */

import { useEffect, useRef, useState } from 'react';
import { TossAds } from '@apps-in-toss/web-framework';

const TEST_AD_GROUP_ID = 'ait-ad-test-banner-id';
const AD_BANNER_HEIGHT = 96;

interface AdEnv {
  VITE_TOSS_AD_GROUP_ID?: string;
  DEV?: boolean;
}

/** env 우선, 미설정 시 개발 환경에서만 테스트 광고 ID. */
export function resolveAdGroupId(env: AdEnv = import.meta.env): string | null {
  const fromEnv = env.VITE_TOSS_AD_GROUP_ID?.trim();
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  return env.DEV ? TEST_AD_GROUP_ID : null;
}

function adsSupported(): boolean {
  try {
    return Boolean(TossAds?.attachBanner?.isSupported?.());
  } catch {
    return false;
  }
}

export function AdBanner() {
  const ref = useRef<HTMLDivElement>(null);
  const [supported] = useState(adsSupported);

  useEffect(() => {
    if (!supported) return;
    const adGroupId = resolveAdGroupId();
    if (!adGroupId) return;
    const el = ref.current;
    if (!el) return;

    let attached: { destroy: () => void } | undefined;
    let cancelled = false;

    try {
      TossAds.initialize({
        callbacks: {
          onInitialized: () => {
            if (cancelled) return;
            try {
              attached =
                TossAds.attachBanner(adGroupId, el, {
                  theme: 'auto',
                  tone: 'blackAndWhite',
                  variant: 'expanded',
                }) ?? undefined;
            } catch {
              // 부착 실패 — 빈 컨테이너 유지(SDK 가 다음 갱신에서 재시도).
            }
          },
          onInitializationFailed: () => {
            // SDK 초기화 실패 — 빈 컨테이너 유지.
          },
        },
      });
    } catch {
      // SDK 미지원/예외 — 빈 컨테이너 유지.
    }

    return () => {
      cancelled = true;
      attached?.destroy();
    };
  }, [supported]);

  if (!supported || !resolveAdGroupId()) return null;
  // 컨테이너 내부는 비워둔다(SDK 가 광고 DOM 을 주입).
  return <div ref={ref} data-testid="ad-banner" style={{ width: '100%', height: AD_BANNER_HEIGHT }} />;
}
