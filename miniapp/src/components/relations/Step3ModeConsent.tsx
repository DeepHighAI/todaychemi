/**
 * Step3ModeConsent.tsx — 스텝 3: 관계 모드 선택 + 동의 + 제출
 *
 * 웹앱 src/app/(app)/relations/new/mode/page.tsx 포트.
 * - FeaturePaySheet → 402 시 Toss IAP 시트(useFeaturePurchase) 연결.
 * - useMutation(apiFetch) 사용.
 * - 402 PAYMENT_REQUIRED 시 relation_slot 고지 모달 표시.
 * - 성공 시 /feed 내비게이션 (useNavigate).
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { apiFetch, ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useFeaturePurchase } from '@/components/iap/use-feature-purchase';
import { FeaturePayCard } from '@/components/iap/feature-pay-card';
import { IAP_DISPLAY_PRICE_KRW } from '@/lib/iap/prices';
import {
  shortageText,
  tokenUseConfirmText,
  type FeaturePreflightResponse,
} from '@/lib/payments/preflight';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { DraftMode } from '@/lib/relations/draft-store';
import type { FeedItem } from '@/types/relation';

// 가격 표시 — 단일 출처 IAP_DISPLAY_PRICE_KRW (오픈초기 50% 할인 적용가, 웹·미니앱 통일).
const RELATION_SLOT_PRICE_KRW = IAP_DISPLAY_PRICE_KRW.relation_slot;
const FREE_RELATION_SLOTS = 2;

const MODE_META: { value: Exclude<DraftMode, ''>; emoji: string }[] = [
  { value: '썸합', emoji: '💗' },
  { value: '오래합', emoji: '❤️' },
  { value: '일합', emoji: '💼' },
  { value: '친구합', emoji: '👋' },
  { value: '돈합', emoji: '💰' },
  { value: '첫합', emoji: '✨' },
];

/** POST /api/relations 요청 body shape (웹앱 RelationCreate 와 동일) */
interface RelationCreateBody {
  nickname: string;
  mode: Exclude<DraftMode, ''>;
  gender: 'M' | 'F';
  birth_date: string;
  birth_date_calendar: 'solar' | 'lunar';
  is_lunar_leap: boolean;
  birth_time_knowledge: 'exact' | 'approximate' | 'unknown';
  birth_time: string | null;
  birth_longitude: null;
  consent_confirmed: boolean;
  is_primary: boolean;
}

/** POST /api/relations 성공 응답 */
interface RelationCreateResponse {
  ok: boolean;
  relation_id?: string;
}

type RelationSubmitResult =
  | RelationCreateResponse
  | { ok: false; token_required: FeaturePreflightResponse }
  | { ok: false; pay_required: FeaturePreflightResponse };

interface Step3Props {
  /** draft 로부터 조립된 전체 body 파라미터 */
  createBody: Omit<RelationCreateBody, 'mode' | 'consent_confirmed'>;
  initialMode: DraftMode;
  initialConsent: boolean;
  onSuccess: () => void;
}

export function Step3ModeConsent({ createBody, initialMode, initialConsent, onSuccess }: Step3Props) {
  const t = useTranslations('relations.new');
  const navigate = useNavigate();
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<DraftMode>(initialMode);
  const [consent, setConsent] = useState(initialConsent);

  // 402 수신 시 결제 정보 보관 — IAP 시트 오픈용
  const [paywallInfo, setPaywallInfo] = useState<{
    feature: string;
    ref: string;
    amount_krw: number;
  } | null>(null);
  const [slotPreflight, setSlotPreflight] = useState<FeaturePreflightResponse | null>(null);
  const [tokenConfirm, setTokenConfirm] = useState<FeaturePreflightResponse | null>(null);
  const [refundConsent, setRefundConsent] = useState(false);

  function invalidateRelationViews(relationId: string) {
    void queryClient.invalidateQueries({ queryKey: ['feed'] });
    void queryClient.invalidateQueries({ queryKey: ['relations'] });
    void queryClient.invalidateQueries({ queryKey: ['relation-detail', relationId] });
    void queryClient.invalidateQueries({ queryKey: ['today'] });
  }

  // IAP 결제 훅 — 성공 시 relation 생성 재시도
  const {
    purchase: openIapPurchase,
    isPurchasing,
    purchaseError: iapError,
    purchaseErrorMessage: iapErrorMessage,
    clearError: clearIapError,
  } = useFeaturePurchase({
    onSuccess: (result) => {
      const relationId = result.delivery?.feature === 'relation_slot'
        ? result.delivery.relation_id
        : null;
      if (relationId) {
        setPaywallInfo(null);
        invalidateRelationViews(relationId);
        onSuccess();
        navigate(`/feed/${relationId}`, { replace: true });
        return;
      }
      setPaywallInfo(null);
      // 결제 완료 후 서버가 unlock row 를 가지고 있으므로 재제출
      mutation.mutate();
    },
  });

  const confirmSlot = useMutation<RelationCreateResponse, ApiError, string>({
    mutationFn: (ref) => apiFetch<RelationCreateResponse>('/api/relations/confirm-slot', {
      method: 'POST',
      body: { ref },
      token,
    }),
    onSuccess: (data) => {
      if (data.relation_id) invalidateRelationViews(data.relation_id);
      onSuccess();
      const target = data.relation_id ? `/feed?focus=${data.relation_id}` : '/feed';
      navigate(target);
    },
    onError: (err) => {
      if (err.status === 402 && err.payment) {
        setPaywallInfo({
          feature: err.payment.feature || 'relation_slot',
          ref: err.payment.ref,
          amount_krw: err.payment.amount_krw,
        });
      }
    },
  });

  // ['feed'] 캐시에서 현재 보유 인연 수를 추정 — 사전 고지 표시 결정
  const ownedCount = useMemo(() => {
    const entries = queryClient.getQueriesData<FeedItem[]>({ queryKey: ['feed'] });
    for (const [, cached] of entries) {
      if (Array.isArray(cached)) return cached.length;
    }
    return null;
  }, [queryClient]);
  const showPaywallNotice = ownedCount !== null && ownedCount >= FREE_RELATION_SLOTS;

  const mutation = useMutation<RelationSubmitResult, ApiError, void>({
    mutationFn: async () => {
      if (!mode) throw new Error('mode required');
      const body: RelationCreateBody = {
        ...createBody,
        mode: mode as Exclude<DraftMode, ''>,
        consent_confirmed: consent,
      };
      const prepared = await apiFetch<FeaturePreflightResponse>('/api/relations/prepare-slot', {
        method: 'POST',
        body,
        token,
      });
      if (prepared.mode === 'token_required') {
        return { ok: false, token_required: prepared };
      }
      if (prepared.mode === 'pay_required') {
        return { ok: false, pay_required: prepared };
      }
      if (prepared.mode === 'unlocked' && prepared.ref) {
        return apiFetch<RelationCreateResponse>('/api/relations/confirm-slot', {
          method: 'POST',
          body: { ref: prepared.ref },
          token,
        });
      }
      return apiFetch<RelationCreateResponse>('/api/relations', {
        method: 'POST',
        body,
        token,
      });
    },
    onSuccess: (data) => {
      if ('token_required' in data) {
        setSlotPreflight(data.token_required);
        setTokenConfirm(data.token_required);
        return;
      }
      if ('pay_required' in data) {
        setSlotPreflight(data.pay_required);
        const payment = data.pay_required.payment;
        if (payment) {
          setPaywallInfo({
            feature: payment.feature || 'relation_slot',
            ref: payment.ref,
            amount_krw: payment.amount_krw,
          });
        }
        return;
      }
      // 피드 캐시 무효화 — 새로 생성된 인연이 리스트에 반영되도록
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      onSuccess();
      const target = data.relation_id ? `/feed?focus=${data.relation_id}` : '/feed';
      navigate(target);
    },
    onError: (err: ApiError) => {
      if (err.status === 402 && err.payment) {
        // 인연 슬롯 과금 — Toss IAP 시트 연결
        setPaywallInfo({
          feature: err.payment.feature || 'relation_slot',
          ref: err.payment.ref,
          amount_krw: err.payment.amount_krw,
        });
      }
      // 그 외 에러는 mutation.error 로 자동 전달
    },
  });

  const canSubmit = !!mode && consent && !mutation.isPending && !confirmSlot.isPending && !isPurchasing;

  return (
    <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h1
        style={{
          font: 'var(--t-h1)',
          letterSpacing: 'var(--ls-tight)',
          color: 'var(--foreground)',
          whiteSpace: 'pre-line',
          margin: 0,
        }}
      >
        {t('step3.headline')}
      </h1>
      <p style={{ font: 'var(--t-sub)', color: 'var(--text-secondary)', margin: 0 }}>
        {t('step3.body')}
      </p>

      {/* 모드 선택 그리드 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {MODE_META.map(({ value, emoji }) => {
          const active = mode === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              style={{
                padding: 14,
                borderRadius: 'var(--r-md)',
                textAlign: 'left',
                border: `1px solid ${active ? 'var(--p-40)' : 'var(--border)'}`,
                backgroundColor: active ? 'var(--p-90)' : 'var(--card)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                transition: 'border-color 0.15s, background-color 0.15s',
              }}
            >
              <span style={{ fontSize: 22, lineHeight: 1 }}>{emoji}</span>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: 14,
                  color: active ? 'var(--p-10)' : 'var(--foreground)',
                }}
              >
                {t(`mode.${value}` as Parameters<typeof t>[0])}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: active ? 'var(--p-30)' : 'var(--text-secondary)',
                }}
              >
                {t(`modeQuestion.${value}` as Parameters<typeof t>[0])}
              </span>
            </button>
          );
        })}
      </div>

      {/* 동의 체크박스 */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px' }}>
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          style={{ width: 16, height: 16, accentColor: 'var(--primary)' }}
        />
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {t('consent.label')}
        </span>
      </label>

      {/* 사전 가격 고지 (캐시 기반, 권위 게이트는 서버 402) */}
      {showPaywallNotice && (
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', padding: '0 4px', margin: 0 }}>
          {t('paywall.notice', {
            price: RELATION_SLOT_PRICE_KRW.toLocaleString(),
          })}
        </p>
      )}

      {/* 일반 에러 (402 제외) */}
      {mutation.error && mutation.error.status !== 402 && (
        <p style={{ font: 'var(--t-sub)', color: 'var(--destructive)', textAlign: 'center', margin: 0 }}>
          {t('errors.generic')}
        </p>
      )}

      {/* 402 결제 필요 — Toss IAP 시트 연결 (공용 FeaturePayCard) */}
      {paywallInfo && (
        <FeaturePayCard
          tone="warn"
          title="부적이 부족해요"
          description={slotPreflight
            ? `${shortageText(slotPreflight.balance, slotPreflight.shortage)} 인연 등록 비용: ${paywallInfo.amount_krw.toLocaleString()}원`
            : `인연 등록 비용: ${paywallInfo.amount_krw.toLocaleString()}원`}
          amountKrw={paywallInfo.amount_krw}
          consentChecked={refundConsent}
          onConsentChange={setRefundConsent}
          consentNotice="인연 등록이 완료되면 「전자상거래법」상 청약철회가 제한됩니다."
          isPurchasing={isPurchasing}
          hasError={!!iapError}
          errorMessage={iapErrorMessage ?? undefined}
          onPay={() => {
            clearIapError();
            openIapPurchase(paywallInfo);
          }}
          onClose={() => { clearIapError(); setPaywallInfo(null); }}
        />
      )}

      <ConfirmDialog
        open={!!tokenConfirm}
        title={tokenUseConfirmText(tokenConfirm?.token_cost ?? 0)}
        confirmLabel="사용할께"
        cancelLabel="나중에 볼께"
        isPending={confirmSlot.isPending}
        onConfirm={() => {
          const ref = tokenConfirm?.ref;
          setTokenConfirm(null);
          if (ref) confirmSlot.mutate(ref);
        }}
        onCancel={() => setTokenConfirm(null)}
      />

      {/* 고정 하단 버튼 */}
      <div
        style={{
          position: 'fixed',
          bottom: 16,
          left: 16,
          right: 16,
          maxWidth: 448,
          margin: '0 auto',
        }}
      >
        <Button
          onClick={() => mutation.mutate()}
          disabled={!canSubmit}
          variant="default"
          size="cta"
          className="btn-cta"
        >
          {mutation.isPending ? t('submitting') : t('submit')}
        </Button>
      </div>
      <div style={{ height: 80 }} />
    </div>
  );
}
