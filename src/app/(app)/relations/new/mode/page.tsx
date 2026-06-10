'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { FeaturePaySheet } from '@/components/payments/feature-pay-sheet';
import { FEATURE_PRICES_KRW, FREE_RELATION_SLOTS } from '@/lib/payments/feature-prices';
import { useRelationDraft } from '@/lib/relations/draft-store';
import type { DraftMode } from '@/lib/relations/draft-store';
import type { FeedItem, RelationCreate } from '@/types/relation';

const MODE_META: { value: Exclude<DraftMode, ''>; emoji: string }[] = [
  { value: '썸합', emoji: '💗' },
  { value: '오래합', emoji: '❤️' },
  { value: '일합', emoji: '💼' },
  { value: '친구합', emoji: '👋' },
  { value: '돈합', emoji: '💰' },
  { value: '첫합', emoji: '✨' },
];

export default function RelationsModePage() {
  const t = useTranslations('relations.new');
  const router = useRouter();
  const draft = useRelationDraft();

  const [mode, setMode] = useState<DraftMode>(draft.mode);
  const [consent, setConsent] = useState(draft.consent);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pay, setPay] = useState<{ ref: string; amountKrw: number } | null>(null);

  const canSubmit = !!mode && consent;

  // 사전 가격 고지 (UX 보조) — 권위 게이트는 서버 402. ['feed'] 캐시가 있을 때만 노출.
  const queryClient = useQueryClient();
  const ownedCount = useMemo(() => {
    const entries = queryClient.getQueriesData<FeedItem[]>({ queryKey: ['feed'] });
    for (const [, cached] of entries) {
      if (Array.isArray(cached)) return cached.length;
    }
    return null;
  }, [queryClient]);
  const showPaywallNotice = ownedCount !== null && ownedCount >= FREE_RELATION_SLOTS;

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const body: RelationCreate = {
        nickname: draft.nickname.trim(),
        mode: mode as RelationCreate['mode'],
        gender: draft.gender as 'M' | 'F',
        birth_date: draft.birthDate,
        birth_date_calendar: draft.calendar,
        is_lunar_leap: false,
        birth_time_knowledge: draft.knowledge,
        birth_time: draft.knowledge === 'unknown' ? null : draft.birthTime,
        birth_longitude: null,
        consent_confirmed: consent,
        is_primary: false,
      };
      const res = await fetch('/api/relations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      // 유료 슬롯(3번째 인연부터) — generic 분기보다 먼저 402 를 가로채 결제 시트를 연다.
      // draft.reset() 은 보류: 결제 취소 시 입력이 살아 있어야 한다. 등록 자체는
      // 서버가 pending 에 스테이징해 confirm 시 머티리얼라이즈한다.
      if (res.status === 402) {
        const payBody = (await res.json().catch(() => null)) as {
          error?: { code?: string };
          ref?: string;
          amount_krw?: number;
        } | null;
        if (payBody?.error?.code === 'PAYMENT_REQUIRED' && payBody.ref) {
          setPay({ ref: payBody.ref, amountKrw: payBody.amount_krw ?? 0 });
          setSubmitting(false);
          return;
        }
      }
      if (!res.ok) {
        setError(t('errors.generic'));
        setSubmitting(false);
        return;
      }
      const created = (await res.json().catch(() => null)) as { relation_id?: string } | null;
      draft.reset();
      router.push(created?.relation_id ? `/feed?focus=${created.relation_id}` : '/feed');
    } catch {
      setError(t('errors.generic'));
      setSubmitting(false);
    }
  }

  return (
    <div className="px-4 space-y-5">
      <h1 className="font-h1 text-foreground whitespace-pre-line">{t('step3.headline')}</h1>
      <p className="font-sub text-muted-foreground">{t('step3.body')}</p>
      <div className="grid grid-cols-2 gap-2.5">
        {MODE_META.map(({ value, emoji }) => {
          const active = mode === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={`p-3.5 rounded-[var(--r-md)] text-left border transition flex flex-col gap-1.5 ${
                active ? 'border-[var(--p-40)] bg-[var(--p-90)]' : 'border-border bg-card'
              }`}
            >
              <span className="text-[22px] leading-none">{emoji}</span>
              <span className={`font-bold text-[14px] ${active ? 'text-[var(--p-10)]' : 'text-foreground'}`}>
                {t(`mode.${value}`)}
              </span>
              <span className={`text-[11px] ${active ? 'text-[var(--p-30)]' : 'text-muted-foreground'}`}>
                {t(`modeQuestion.${value}`)}
              </span>
            </button>
          );
        })}
      </div>
      <label className="flex items-center gap-2.5 px-1">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="h-4 w-4 accent-primary"
        />
        <span className="text-[12px] text-muted-foreground">{t('consent.label')}</span>
      </label>
      {showPaywallNotice && (
        <p className="text-[12px] text-muted-foreground text-center px-1">
          {t('paywall.notice', {
            price: FEATURE_PRICES_KRW.relation_slot.amount_krw.toLocaleString(),
          })}
        </p>
      )}
      {error && <p className="font-sub text-destructive text-center">{error}</p>}
      <div className="fixed bottom-4 inset-x-4 max-w-md mx-auto">
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          variant="default"
          className="h-12 w-full rounded-[var(--r-pill)] font-bold"
        >
          {submitting ? t('submitting') : t('submit')}
        </Button>
      </div>
      {pay && (
        <FeaturePaySheet
          feature="relation_slot"
          featureRef={pay.ref}
          next="/feed"
          open
          onOpenChange={(open) => {
            if (!open) {
              setPay(null);
              setError(t('errors.payment'));
            }
          }}
          // 정상 결제는 confirm 303 전면 리다이렉트로 떠난다 — onPaid 는 init 이
          // unlocked(이미 결제된 더블서브밋)를 반환한 경우의 전진용.
          onPaid={() => router.push('/feed')}
        />
      )}
    </div>
  );
}
