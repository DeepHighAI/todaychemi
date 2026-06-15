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
import { RefundRestrictionConsent } from '@/components/iap/refund-consent';
import type { DraftMode } from '@/lib/relations/draft-store';
import type { FeedItem } from '@/types/relation';

// 가격 상수 — 웹앱 feature-prices.ts 와 동기화 (ADR-039 Amended, 2026-06-07 D6).
// 웹앱 단일 출처가 변경되면 여기도 갱신 필요 (§1.3 TODO: 단일 출처 파생 방법 검토).
const RELATION_SLOT_PRICE_KRW = 1_000;
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
  const [refundConsent, setRefundConsent] = useState(false);

  // IAP 결제 훅 — 성공 시 relation 생성 재시도
  const { purchase: openIapPurchase, isPurchasing, purchaseError: iapError, clearError: clearIapError } = useFeaturePurchase({
    onSuccess: () => {
      setPaywallInfo(null);
      // 결제 완료 후 서버가 unlock row 를 가지고 있으므로 재제출
      mutation.mutate();
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

  const mutation = useMutation<RelationCreateResponse, ApiError, void>({
    mutationFn: async () => {
      if (!mode) throw new Error('mode required');
      const body: RelationCreateBody = {
        ...createBody,
        mode: mode as Exclude<DraftMode, ''>,
        consent_confirmed: consent,
      };
      return apiFetch<RelationCreateResponse>('/api/relations', {
        method: 'POST',
        body,
        token,
      });
    },
    onSuccess: (data) => {
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

  const canSubmit = !!mode && consent && !mutation.isPending;

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

      {/* 402 결제 필요 — Toss IAP 시트 연결 */}
      {paywallInfo && (
        <div
          style={{
            borderRadius: 'var(--r-md)',
            backgroundColor: 'var(--warn-bg, #fff8e1)',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <p style={{ font: 'var(--t-sub)', color: 'var(--warn, #b45309)', margin: 0 }}>
            {t('errors.payment')}
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
            인연 등록 비용: {paywallInfo.amount_krw.toLocaleString()}원
          </p>
          {iapError && (
            <p style={{ fontSize: 12, color: 'var(--destructive)', margin: 0 }}>
              결제 중 오류가 발생했어요. 다시 시도해 주세요.
            </p>
          )}
          <RefundRestrictionConsent
            checked={refundConsent}
            onCheckedChange={setRefundConsent}
            notice="인연 등록이 완료되면 「전자상거래법」상 청약철회가 제한됩니다."
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              size="sm"
              disabled={isPurchasing || !refundConsent}
              onClick={() => {
                clearIapError();
                openIapPurchase(paywallInfo);
              }}
              style={{ alignSelf: 'flex-start' }}
            >
              {isPurchasing ? '결제 중…' : `₩${paywallInfo.amount_krw.toLocaleString()} 결제하기`}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { clearIapError(); setPaywallInfo(null); }}
              style={{ alignSelf: 'flex-start' }}
            >
              닫기
            </Button>
          </div>
        </div>
      )}

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
          style={{ height: 48, width: '100%', borderRadius: 'var(--r-pill)', fontWeight: 700 }}
        >
          {mutation.isPending ? t('submitting') : t('submit')}
        </Button>
      </div>
      <div style={{ height: 80 }} />
    </div>
  );
}
