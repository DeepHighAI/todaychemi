/**
 * replay-button.tsx — 케미 다시 맞추기 버튼 (미니앱 포트)
 *
 * 웹앱 원본: src/components/hapcard/replay-button.tsx
 *
 * 변경:
 *   - useSearchParams(next/navigation) → useSearchParams(react-router-dom)
 *   - useRouter(next/navigation) → 미사용 (결제 후 복귀는 useSearchParams 감지)
 *   - FeaturePaySheet 제거 → 402 시 Toss IAP 시트(useFeaturePurchase) 연결
 *   - fetch('/api/...') → apiFetch(path, { token })
 *   - next-intl useTranslations 유지 (App.tsx 의 NextIntlClientProvider 통해 제공됨)
 */

import { useState, useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth/AuthProvider';
import { apiFetch } from '@/lib/api/client';
import { useFeaturePurchase } from '@/components/iap/use-feature-purchase';
import { RefundRestrictionConsent } from '@/components/iap/refund-consent';
import { IAP_DISPLAY_PRICE_KRW } from '@/lib/iap/prices';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ERROR_COPY } from '@/lib/errors/error-codes';
import type { HapcardResult } from '@/types/hapcard';

interface Props {
  hapcardId: string;
  relationId: string;
  mode: string;
  targetDate: string;
}

type State = 'idle' | 'loading' | 'success' | 'error' | 'pay_required';

/** 케미 다시 맞추기 호출 — apiFetch(중첩 { error:{code,message} } 봉투 + 402 payment 파싱). */
async function postReplay(hapcardId: string, token: string | null): Promise<HapcardResult> {
  return apiFetch<HapcardResult>(`/api/hapcards/${hapcardId}/replay`, { method: 'POST', token });
}

export function HapcardReplayButton({ hapcardId, relationId, mode, targetDate }: Props) {
  const t = useTranslations('hapcard');
  const qc = useQueryClient();
  const { token } = useAuth();
  // react-router-dom: useSearchParams 반환은 [params, setParams] 튜플
  const [searchParams] = useSearchParams();
  const replayParam = searchParams.get('replay');

  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // 결제 필요 상태 — IAP 연결용 payment 정보 보관
  const [payInfo, setPayInfo] = useState<{ feature: string; ref: string; amount_krw: number } | null>(null);
  const [autoReplay, setAutoReplay] = useState(false);
  const [refundConsent, setRefundConsent] = useState(false);

  // IAP 결제 훅 — 성공 시 replay 재시도 (unlock row 있으면 200, 재과금 없음)
  const { purchase: openIapPurchase, isPurchasing, purchaseError: iapError, clearError: clearIapError } = useFeaturePurchase({
    onSuccess: () => {
      setPayInfo(null);
      setState('loading');
      mutation.mutate();
    },
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoFired = useRef(false);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const mutation = useMutation({
    mutationFn: (): Promise<HapcardResult> => postReplay(hapcardId, token),
    onSuccess: (result) => {
      // 케시 갱신 — HapcardView 의 useQuery 와 동일 키
      qc.setQueryData(['hapcard', relationId, mode, targetDate], result);
      qc.invalidateQueries({ queryKey: ['hapcard-snapshots', hapcardId] });
      setState('success');
      timerRef.current = setTimeout(() => {
        setOpen(false);
        setState('idle');
      }, 1500);
    },
    onError: (err: unknown) => {
      const e = err as {
        status?: number;
        code?: string;
        payment?: { feature: string; ref: string; amount_krw: number };
      };
      // 402 PAYMENT_REQUIRED — Toss IAP 시트 연결 (apiFetch 가 .payment 를 채움)
      if (e.status === 402 || e.code === 'PAYMENT_REQUIRED') {
        setPayInfo(e.payment ?? null);
        setState('pay_required');
        return;
      }
      // 그 외 에러: error-codes 카탈로그에서 복사본 검색
      const rawCode = e.code ?? 'INTERNAL_ERROR';
      const msg =
        (rawCode in ERROR_COPY)
          ? ERROR_COPY[rawCode as keyof typeof ERROR_COPY]
          : ERROR_COPY.INTERNAL_ERROR;
      setErrorMsg(msg);
      setState('error');
    },
  });

  // 결제 완료 후 복귀(?replay=1) → 다이얼로그 자동 재오픈 + 1회 재발화.
  // 재POST 는 잠금해제된 row 반환(200) — 재과금 없음.
  useEffect(() => {
    if (replayParam === '1' && !autoFired.current) {
      autoFired.current = true;
      setAutoReplay(true);
      setOpen(true);
      setState('loading');
      mutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayParam]);

  function handleOpen(v: boolean) {
    if (!v) {
      setState('idle');
      setErrorMsg(null);
      setAutoReplay(false);
      setPayInfo(null);
      clearIapError();
    }
    setOpen(v);
  }

  function handleConfirm() {
    setState('loading');
    mutation.mutate();
  }

  function handleRetry() {
    setState('idle');
    setErrorMsg(null);
    setPayInfo(null);
    clearIapError();
  }

  const isLoading = state === 'loading';

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      {/* 트리거 버튼 */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          borderRadius: 12,
          border: '1px solid var(--border)',
          backgroundColor: 'var(--bg-card)',
          padding: '10px 16px',
          fontSize: 14,
          fontWeight: 500,
          color: 'var(--text-primary)',
          cursor: 'pointer',
          width: '100%',
          justifyContent: 'center',
        }}
      >
        <RefreshCw style={{ width: 16, height: 16 }} aria-hidden />
        {t('replayButton.label')}
      </button>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('replayButton.confirmTitle')}</DialogTitle>
          <DialogDescription>
            {autoReplay
              ? t('replayButton.afterPayLoading')
              : t('replayButton.confirmBody')}
          </DialogDescription>
        </DialogHeader>

        {/* 성공 */}
        {state === 'success' && (
          <p style={{ fontSize: 14, textAlign: 'center', color: 'var(--primary)', padding: '8px 0' }}>
            {t('replayButton.successToast')}
          </p>
        )}

        {/* 오류 */}
        {state === 'error' && (
          <div
            role="alert"
            style={{
              borderRadius: 12,
              backgroundColor: 'color-mix(in srgb, var(--destructive) 10%, transparent)',
              padding: 12,
              fontSize: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <p style={{ margin: 0, color: 'var(--destructive)' }}>{errorMsg}</p>
            <Button variant="outline" size="sm" onClick={handleRetry}>
              다시 시도
            </Button>
          </div>
        )}

        {/* 결제 필요 — Toss IAP 시트 연결 */}
        {state === 'pay_required' && (
          <div
            role="alert"
            style={{
              borderRadius: 12,
              backgroundColor: 'color-mix(in srgb, var(--primary) 8%, transparent)',
              padding: 12,
              fontSize: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <p style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 600 }}>
              케미 다시 맞추기는 ₩{(payInfo?.amount_krw ?? IAP_DISPLAY_PRICE_KRW.replay).toLocaleString()}이 필요해요.
            </p>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>
              결제 후 바로 새 케미카드를 확인할 수 있어요.
            </p>
            {iapError && (
              <p style={{ margin: 0, color: 'var(--destructive)', fontSize: 12 }}>
                결제 중 오류가 발생했어요. 다시 시도해 주세요.
              </p>
            )}
            <RefundRestrictionConsent checked={refundConsent} onCheckedChange={setRefundConsent} />
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                size="sm"
                disabled={isPurchasing || !payInfo || !refundConsent}
                onClick={() => {
                  clearIapError();
                  if (payInfo) openIapPurchase(payInfo);
                }}
              >
                {isPurchasing ? '결제 중…' : `₩${(payInfo?.amount_krw ?? IAP_DISPLAY_PRICE_KRW.replay).toLocaleString()} 결제하기`}
              </Button>
              <Button variant="outline" size="sm" onClick={handleRetry}>
                닫기
              </Button>
            </div>
          </div>
        )}

        {/* 확인/취소 푸터 — 성공/페이/autoReplay 상태가 아닐 때 */}
        {state !== 'success' && state !== 'pay_required' && !autoReplay && (
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => handleOpen(false)}
              disabled={isLoading}
            >
              {t('replayButton.cancel')}
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isLoading || state === 'error'}
            >
              {isLoading ? '처리 중…' : t('replayButton.confirmCta')}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
