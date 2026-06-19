/**
 * ad-banner.tsx — 앱인토스 인앱 배너 광고 (항목 4)
 *
 * 토스 WebView SDK `TossAds.attachBanner` 로 리스트형 배너를 부착한다.
 * - 토스앱 5.241.0 미만/웹 dev 등 미지원 환경: `isSupported()` false → 아무것도 렌더하지 않음(빈 화면 방지).
 * - 광고 그룹 ID: env `VITE_TOSS_AD_GROUP_ID`(dev 미설정 시에만 테스트 ID `ait-ad-test-banner-id`).
 * - 컨테이너 내부는 비워둬야 하며(SDK 가 DOM 주입), width 100% + 고정 높이 96px.
 *
 * 토스 정책: 결제/인증 흐름에는 광고 금지, 다른 UI 와 겹치지 않게, SDK 기본 동작 변조 금지.
 *
 * 초기화 전략(공식 BannerAd 문서 권장): `TossAds.initialize` 는 앱 전역에서 단 1회만 호출하고,
 * 각 배너는 공유 ready 상태가 되면 attach 한다. 인스턴스별 init + 자신의 onInitialized 안에서 attach 하면
 * SDK 가 중복 init 의 onInitialized 를 발화하지 않을 경우 2번째 이후 배너가 attach 되지 않으므로 금지.
 * (App.tsx 마운트 시 `ensureTossAdsInitialized()` 1회 호출 + 각 AdBanner 는 `useTossAdsReady()` 구독)
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

/** 광고 슬롯을 실제로 채울 수 있는 환경인지(지원 + 광고 그룹 ID 존재). 빈 래퍼 렌더 방지용. */
export function isAdSlotAvailable(env: AdEnv = import.meta.env): boolean {
  return adsSupported() && resolveAdGroupId(env) !== null;
}

// ── 앱 전역 단일 초기화 싱글톤 ───────────────────────────────────────────────
// SDK 의 중복-init 동작과 무관하게 항상 올바르도록, 모듈 스코프에서 init 을 1회만 수행하고
// ready 가 되면 구독자(각 AdBanner)에게 통지한다.
type AdsInitState = 'idle' | 'initializing' | 'ready' | 'failed';
let initState: AdsInitState = 'idle';
const readyListeners = new Set<() => void>();

function notifyReady() {
  readyListeners.forEach((listener) => listener());
}

/** 토스 광고 SDK 를 1회만 초기화한다(이미 진행/완료 시 no-op). 앱 최상위에서 호출 권장. */
export function ensureTossAdsInitialized(): void {
  if (!adsSupported()) return;
  if (initState === 'initializing' || initState === 'ready') return;
  initState = 'initializing';
  try {
    TossAds.initialize({
      callbacks: {
        onInitialized: () => {
          initState = 'ready';
          notifyReady();
        },
        onInitializationFailed: () => {
          // SDK 초기화 실패 — 배너는 빈 컨테이너 유지. 다음 앱 진입에서 재시도 가능하도록 idle 복귀.
          initState = 'idle';
        },
      },
    });
  } catch {
    // SDK 미지원/예외 — idle 복귀(빈 컨테이너 유지).
    initState = 'idle';
  }
}

/** 광고 SDK 초기화 완료 여부를 구독한다. 마운트 시 초기화를 보장하고 ready 가 되면 true. */
export function useTossAdsReady(): boolean {
  const [ready, setReady] = useState(() => initState === 'ready');

  useEffect(() => {
    if (!adsSupported()) return;
    if (initState === 'ready') {
      setReady(true);
      return;
    }
    const listener = () => setReady(true);
    readyListeners.add(listener);
    ensureTossAdsInitialized();
    return () => {
      readyListeners.delete(listener);
    };
  }, []);

  return ready;
}

/** 테스트 전용 — 모듈 싱글톤 상태를 초기화한다(테스트 간 누수 차단). */
export function __resetTossAdsForTest(): void {
  initState = 'idle';
  readyListeners.clear();
}

export function AdBanner() {
  const ref = useRef<HTMLDivElement>(null);
  const [supported] = useState(adsSupported);
  const ready = useTossAdsReady();
  const adGroupId = resolveAdGroupId();

  useEffect(() => {
    if (!ready || !adGroupId) return;
    const el = ref.current;
    if (!el) return;

    let attached: { destroy: () => void } | undefined;
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

    return () => {
      attached?.destroy();
    };
  }, [ready, adGroupId]);

  if (!supported || !adGroupId) return null;
  // 컨테이너 내부는 비워둔다(SDK 가 광고 DOM 을 주입). ready 전에는 빈 96px 컨테이너(부착 대기).
  return <div ref={ref} data-testid="ad-banner" style={{ width: '100%', height: AD_BANNER_HEIGHT }} />;
}
