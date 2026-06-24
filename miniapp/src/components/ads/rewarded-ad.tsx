/**
 * rewarded-ad.tsx — 앱인토스 보상형 광고 CTA.
 *
 * 공식 흐름: loadFullScreenAd 로 미리 불러오고, 사용자 클릭 시 showFullScreenAd 로 노출한다.
 * 서버 보상은 show 이벤트 중 userEarnedReward 에서만 호출한다.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Gift, Loader2 } from 'lucide-react';
import { loadFullScreenAd, showFullScreenAd } from '@apps-in-toss/web-framework';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { apiFetch } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { showRewardNotice } from '@/components/rewards/reward-notice-store';

const TEST_REWARDED_AD_GROUP_ID = 'ait-ad-test-rewarded-id';
const EXPECTED_REWARD_UNIT_TYPE = '부적';
const EXPECTED_REWARD_AMOUNT = 5;

interface RewardedAdEnv {
  VITE_TOSS_REWARDED_AD_GROUP_ID?: string;
  DEV?: boolean;
}

interface AdRewardStatusResponse {
  ok: true;
  reward: {
    amount_awarded: number;
    daily_cap: number;
    awarded_today: number;
    remaining: number;
  };
}

interface AdRewardGrantResponse {
  ok: true;
  reward?: {
    awarded?: boolean;
    reason?: string;
    amount_awarded?: number;
    balance_after?: number | null;
    remaining?: number;
  };
}

type Cleanup = () => void;

function readRewardedAdEnv(): RewardedAdEnv {
  return {
    VITE_TOSS_REWARDED_AD_GROUP_ID: import.meta.env.VITE_TOSS_REWARDED_AD_GROUP_ID,
    DEV: import.meta.env.DEV,
  };
}

export function resolveRewardedAdGroupId(env: RewardedAdEnv = readRewardedAdEnv()): string | null {
  const fromEnv = env.VITE_TOSS_REWARDED_AD_GROUP_ID?.trim();
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  return env.DEV ? TEST_REWARDED_AD_GROUP_ID : null;
}

function fullScreenAdSupported(): boolean {
  try {
    return Boolean(loadFullScreenAd?.isSupported?.() && showFullScreenAd?.isSupported?.());
  } catch {
    return false;
  }
}

export function isRewardedAdAvailable(env: RewardedAdEnv = readRewardedAdEnv()): boolean {
  return fullScreenAdSupported() && resolveRewardedAdGroupId(env) !== null;
}

export function RewardedAdCard({ env }: { env?: RewardedAdEnv } = {}) {
  const t = useTranslations('rewards.ad');
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const [supported] = useState(fullScreenAdSupported);
  const [loaded, setLoaded] = useState(false);
  const [showing, setShowing] = useState(false);
  const [granting, setGranting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const loadCleanupRef = useRef<Cleanup | null>(null);
  const showCleanupRef = useRef<Cleanup | null>(null);
  const grantRequestedRef = useRef(false);
  const adGroupId = resolveRewardedAdGroupId(env ?? readRewardedAdEnv());

  const statusQuery = useQuery({
    queryKey: ['rewarded-ad-status'],
    queryFn: () => apiFetch<AdRewardStatusResponse>('/api/rewards/ad', { token }),
    enabled: Boolean(token && supported && adGroupId),
    staleTime: 30_000,
  });

  const remaining = statusQuery.data?.reward.remaining ?? 0;
  const rewardAmount = statusQuery.data?.reward.amount_awarded ?? EXPECTED_REWARD_AMOUNT;
  const canPrepare = Boolean(token && supported && adGroupId && statusQuery.isSuccess && remaining > 0);

  const cleanupLoadedAd = useCallback(() => {
    loadCleanupRef.current?.();
    loadCleanupRef.current = null;
    setLoaded(false);
  }, []);

  const loadAd = useCallback(() => {
    if (!adGroupId || !canPrepare) return;
    cleanupLoadedAd();
    setMessage(null);
    try {
      loadCleanupRef.current = loadFullScreenAd({
        options: { adGroupId },
        onEvent: (event) => {
          if (event.type === 'loaded') {
            setLoaded(true);
          }
        },
        onError: (error) => {
          console.warn('[ads] loadFullScreenAd failed', {
            message: error instanceof Error ? error.message : String(error),
          });
          setLoaded(false);
          setMessage(t('loadFailed'));
        },
      });
    } catch (error) {
      console.warn('[ads] loadFullScreenAd threw', {
        message: error instanceof Error ? error.message : String(error),
      });
      setLoaded(false);
      setMessage(t('loadFailed'));
    }
  }, [adGroupId, canPrepare, cleanupLoadedAd, t]);

  useEffect(() => {
    if (!canPrepare) return;
    loadAd();
    return () => {
      loadCleanupRef.current?.();
      loadCleanupRef.current = null;
    };
  }, [canPrepare, loadAd]);

  useEffect(() => {
    if (remaining <= 0) cleanupLoadedAd();
  }, [remaining, cleanupLoadedAd]);

  useEffect(() => () => {
    showCleanupRef.current?.();
    showCleanupRef.current = null;
    loadCleanupRef.current?.();
    loadCleanupRef.current = null;
  }, []);

  if (!token || !supported || !adGroupId || statusQuery.isError) return null;

  async function grantReward() {
    if (!token || grantRequestedRef.current) return;
    grantRequestedRef.current = true;
    setGranting(true);
    try {
      const body = await apiFetch<AdRewardGrantResponse>('/api/rewards/ad', {
        method: 'POST',
        token,
      });
      const reward = body.reward;
      await queryClient.invalidateQueries({ queryKey: ['me-wallet'] });
      await queryClient.invalidateQueries({ queryKey: ['rewarded-ad-status'] });
      if (reward?.awarded && (reward.amount_awarded ?? 0) > 0) {
        const amount = reward.amount_awarded ?? rewardAmount;
        setMessage(t('granted', { count: amount }));
        showRewardNotice({ amount, title: `리워드 부적 ${amount}개를 받았어요` });
        return;
      }
      if (reward?.reason === 'DAILY_LIMIT_REACHED') {
        setMessage(t('limitReached'));
        return;
      }
      setMessage(t('grantUnavailable'));
    } catch (error) {
      console.warn('[ads] rewarded ad grant failed', {
        message: error instanceof Error ? error.message : String(error),
      });
      setMessage(t('grantFailed'));
    } finally {
      setGranting(false);
    }
  }

  function handleShowAd() {
    if (!adGroupId || !loaded || showing || granting || remaining <= 0) return;
    setShowing(true);
    grantRequestedRef.current = false;
    showCleanupRef.current?.();
    showCleanupRef.current = null;
    try {
      showCleanupRef.current = showFullScreenAd({
        options: { adGroupId },
        onEvent: (event) => {
          if (event.type === 'userEarnedReward') {
            const data = event.data as { unitType?: string; unitAmount?: number } | undefined;
            if (
              data?.unitType === EXPECTED_REWARD_UNIT_TYPE &&
              data?.unitAmount === EXPECTED_REWARD_AMOUNT
            ) {
              void grantReward();
            } else {
              setMessage(t('grantUnavailable'));
            }
            return;
          }

          if (event.type === 'failedToShow') {
            setMessage(t('showFailed'));
          }

          if (event.type === 'dismissed' || event.type === 'failedToShow') {
            setShowing(false);
            cleanupLoadedAd();
            window.setTimeout(loadAd, 0);
          }
        },
        onError: (error) => {
          console.warn('[ads] showFullScreenAd failed', {
            message: error instanceof Error ? error.message : String(error),
          });
          setShowing(false);
          cleanupLoadedAd();
          setMessage(t('showFailed'));
          window.setTimeout(loadAd, 0);
        },
      });
    } catch (error) {
      console.warn('[ads] showFullScreenAd threw', {
        message: error instanceof Error ? error.message : String(error),
      });
      setShowing(false);
      cleanupLoadedAd();
      setMessage(t('showFailed'));
      window.setTimeout(loadAd, 0);
    }
  }

  const exhausted = remaining <= 0;
  const disabled = statusQuery.isLoading || exhausted || !loaded || showing || granting;
  const statusText = exhausted
    ? t('remaining', { remaining: 0 })
    : t('remaining', { remaining });

  return (
    <section style={{ padding: '0 16px' }} aria-label={t('sectionLabel')}>
      <button
        type="button"
        className="btn-cta"
        disabled={disabled}
        onClick={handleShowAd}
        style={{
          width: '100%',
          minHeight: 96,
          borderRadius: 'var(--r-xl)',
          border: '1px solid color-mix(in srgb, var(--primary) 18%, transparent)',
          backgroundColor: 'var(--bg-card)',
          color: 'var(--text-primary)',
          boxShadow: 'var(--e-1)',
          padding: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          textAlign: 'left',
          cursor: disabled ? 'default' : 'pointer',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <span
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(135deg, color-mix(in srgb, var(--primary) 12%, transparent), transparent 52%, color-mix(in srgb, var(--ok, #386a20) 12%, transparent))',
          }}
        />
        <span
          aria-hidden
          style={{
            position: 'relative',
            width: 44,
            height: 44,
            borderRadius: 16,
            backgroundColor: 'var(--primary)',
            color: 'var(--primary-foreground)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {statusQuery.isLoading || granting ? <Loader2 size={20} className="animate-spin" /> : <Gift size={20} />}
        </span>
        <span style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 16, fontWeight: 800, lineHeight: 1.2 }}>
            {t('title')}
          </span>
          <span style={{ display: 'block', marginTop: 4, fontSize: 13, fontWeight: 650, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
            {message ?? statusText}
          </span>
        </span>
      </button>
    </section>
  );
}
