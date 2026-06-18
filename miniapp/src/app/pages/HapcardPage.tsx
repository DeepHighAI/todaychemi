/**
 * HapcardPage.tsx — 케미카드 뷰어 (미니앱 포트)
 *
 * 웹앱 원본: src/app/(app)/hapcard/[id]/HapcardView.tsx
 *
 * 변경:
 *   - useParams / useSearchParams / useRouter (next/navigation) → react-router-dom
 *   - next/link <Link href> → <a> / navigate()
 *   - fetch('/api/...') → apiFetch (중첩 { error: { code, message } } 봉투 + 402 payment 파싱)
 *   - FeaturePaySheet → 402 시 인라인 안내 + Toss IAP 시트(useFeaturePurchase)
 *   - trackEvent(ga) → 제거 (미니앱 GA 미연동)
 *   - Tailwind className → 인라인 스타일 + CSS 변수
 *   - 'use client' 제거
 *   - HapcardShare 제거 (공유는 Toss share() API — handleShare → shareHapcard)
 *
 * 케미 다시 맞추기(replay) 기능은 HapcardReplayButton 컴포넌트로 완전 구현됨.
 * 펼침 패널 섹션(오행·근거·역할·흐름·변화)은 모두 포팅 완료.
 */

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, Trash2, Edit2, Check, Share2 } from 'lucide-react';

import { useAuth } from '@/lib/auth/AuthProvider';
import { apiFetch } from '@/lib/api/client';
import { IAP_DISPLAY_PRICE_KRW } from '@/lib/iap/prices';
import { toEasyText } from '@/lib/glossary/easy-term-map';
import { convertHanja } from '@/lib/glossary/post-process';
import {
  formatDetailSummaryLines,
  formatHapcardActionItems,
  formatHeroCoachLines,
} from '@/lib/hapcard/hero-main-text';
import { scoreDeltaToTemperatureDelta, scoreToTemperature } from '@/lib/scoring/temperature';
import { todayKST } from '@/lib/today/kst-date';
import { ERROR_CODES } from '@/lib/errors/error-codes';
import type { ErrorCode } from '@/lib/errors/error-codes';
import type { HapcardResult, HapcardErrorCode } from '@/types/hapcard';

import { AiDisclosureBadge } from '@/components/ai-disclosure/ai-disclosure-badge';
import { ErrorCard } from '@/components/feedback/ErrorCard';
import { useFeaturePurchase } from '@/components/iap/use-feature-purchase';
import { GlossaryProvider } from '@/components/hapcard/glossary-provider';
import { GlossarySheet } from '@/components/hapcard/glossary-sheet';
import { HapcardReplayButton } from '@/components/hapcard/replay-button';
import { shareHapcard } from '@/lib/share/toss-share';
import { RefundRestrictionConsent } from '@/components/iap/refund-consent';
import { HapcardLoadingState } from '@/components/hapcard/loading-state';
import { HapcardOhaeng } from '@/components/hapcard/ohaeng';
import { HapcardEvidence } from '@/components/hapcard/evidence';
import { HapcardCauseFactors } from '@/components/hapcard/cause-factors';
import { HapcardClassic } from '@/components/hapcard/classic';
import { HapcardChangeIndicator } from '@/components/hapcard/change-indicator';
import { HapcardTimeline } from '@/components/hapcard/timeline';
import { HapcardRoleAnalysis } from '@/components/hapcard/role-analysis';
import { HapcardActions } from '@/components/hapcard/actions';

// ---------------------------------------------------------------------------
// 상수
// ---------------------------------------------------------------------------

const DEFAULT_THEORY_PROFILE_VERSION = 'v3';

const RELATION_CHART_PENDING_CODES: string[] = [
  'RELATION_CHART_NOT_FOUND',
  'RELATION_CHART_LOOKUP_FAILED',
];

// ---------------------------------------------------------------------------
// API 함수 — apiFetch 사용.
// apiFetch 는 { error: { code, message } } 중첩 봉투를 ApiError(.status/.code)로 변환하고,
// 402 PAYMENT_REQUIRED 시 .payment={ feature, ref, amount_krw } 를 채운다(IAP 시트용).
// ---------------------------------------------------------------------------

async function callHapcard(
  relationId: string,
  mode: string,
  token: string | null,
): Promise<HapcardResult> {
  return apiFetch<HapcardResult>('/api/hapcards', {
    method: 'POST',
    token,
    body: {
      relation_id: relationId,
      mode,
      theory_profile_version: DEFAULT_THEORY_PROFILE_VERSION,
    },
  });
}

async function deleteRelation(id: string, token: string | null): Promise<void> {
  await apiFetch(`/api/relations/${id}`, { method: 'DELETE', token });
}

async function renameRelation(
  { id, nickname }: { id: string; nickname: string },
  token: string | null,
): Promise<{ relation: { nickname: string } }> {
  return apiFetch<{ relation: { nickname: string } }>(`/api/relations/${id}`, {
    method: 'PATCH',
    token,
    body: { nickname },
  });
}

// ---------------------------------------------------------------------------
// 헬퍼
// ---------------------------------------------------------------------------

function getErrorCode(e: unknown): HapcardErrorCode | undefined {
  return (e as { code?: HapcardErrorCode })?.code;
}

function isUserChartMissingError(e: unknown): boolean {
  return getErrorCode(e) === 'USER_CHART_NOT_FOUND';
}

function isRelationChartPendingError(e: unknown): boolean {
  const code = (e as { code?: string })?.code;
  return RELATION_CHART_PENDING_CODES.includes(code ?? '');
}

function isPaymentRequiredError(e: unknown): boolean {
  const err = e as { status?: number; code?: string };
  return err?.status === 402 || err?.code === 'PAYMENT_REQUIRED';
}

function getErrorCardCode(e: unknown): ErrorCode {
  const code = (e as { code?: string })?.code;
  return ERROR_CODES.includes(code as ErrorCode) ? (code as ErrorCode) : 'INTERNAL_ERROR';
}

function readInitialEasyMode(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const saved = window.localStorage.getItem('hapcard_easy_mode');
    return saved === null ? true : saved === '1';
  } catch {
    return true;
  }
}

// ---------------------------------------------------------------------------
// 펼침 탭
// ---------------------------------------------------------------------------

type ExpandTab = 'summary' | 'ohaeng' | 'evidence' | 'area' | 'flow';

// ---------------------------------------------------------------------------
// 컴포넌트
// ---------------------------------------------------------------------------

export function HapcardPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const t = useTranslations('hapcard');
  const { token } = useAuth();
  const targetDate = todayKST();

  // 케미카드 조회
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['hapcard', id, mode, targetDate],
    queryFn: () => callHapcard(id!, mode!, token),
    enabled: !!id && !!mode,
    retry: false,
  });

  // UI 상태
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [expandOpen, setExpandOpen] = useState(false);
  const [expandTab, setExpandTab] = useState<ExpandTab>('summary');
  const [deleted, setDeleted] = useState(false);
  const [payDismissed, setPayDismissed] = useState(false);
  const [refundConsent, setRefundConsent] = useState(false);

  // IAP 결제 훅 — PAYMENT_REQUIRED(402) 시 Toss IAP 시트 오픈 후 쿼리 무효화
  const { purchase: openIapPurchase, isPurchasing, purchaseError: iapError, clearError: clearIapError } = useFeaturePurchase({
    onSuccess: () => {
      setPayDismissed(false);
      void refetch();
    },
  });
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  // G-5 쉽게 보기
  const [easyMode, setEasyMode] = useState(readInitialEasyMode);

  function toggleEasyMode() {
    setEasyMode((v) => {
      const next = !v;
      try { window.localStorage.setItem('hapcard_easy_mode', next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  }
  const easyText = (text: string) => (easyMode ? toEasyText(text) : text);

  // 삭제 mutation
  const del = useMutation({
    mutationFn: () => deleteRelation(id!, token),
    onSuccess: () => {
      setDeleted(true);
      qc.invalidateQueries({ queryKey: ['feed'] });
      qc.invalidateQueries({ queryKey: ['relations'] });
      qc.invalidateQueries({ queryKey: ['today'] });
    },
  });

  // 별명 수정 mutation
  const rename = useMutation({
    mutationFn: (args: { id: string; nickname: string }) => renameRelation(args, token),
    onSuccess: ({ relation }) => {
      qc.setQueryData<HapcardResult>(['hapcard', id, mode, targetDate], (prev) => (
        prev ? { ...prev, relation_nickname: relation.nickname } : prev
      ));
      qc.invalidateQueries({ queryKey: ['feed'] });
      qc.invalidateQueries({ queryKey: ['relations'] });
      qc.invalidateQueries({ queryKey: ['today'] });
      qc.invalidateQueries({ queryKey: ['relation-detail', id] });
      setRenameOpen(false);
      setRenameError(null);
    },
    onError: () => setRenameError(t('rename.error')),
  });

  const canRename =
    renameValue.trim().length > 0 &&
    renameValue.trim().length <= 20 &&
    !rename.isPending;

  // 삭제 완료 후 피드로
  useEffect(() => {
    if (deleted) {
      const timer = setTimeout(() => navigate('/feed'), 900);
      return () => clearTimeout(timer);
    }
  }, [deleted, navigate]);

  // ---------------------------------------------------------------------------
  // 에러 분기
  // ---------------------------------------------------------------------------

  // mode 미존재
  if (!mode) {
    return (
      <main style={{ minHeight: '100vh', padding: '32px 16px', backgroundColor: 'var(--bg-base)' }}>
        <p style={{ color: 'var(--destructive)', textAlign: 'center', padding: '32px 0', font: 'var(--t-sub)' }}>
          {t('errors.generic')}
        </p>
      </main>
    );
  }

  // 402 결제 필요 — Toss IAP 시트 연결
  if (isError && isPaymentRequiredError(error) && !payDismissed) {
    const payInfo = (error as { payment?: { feature: string; ref: string; amount_krw: number } })?.payment;
    // 고지가 = 서버 제공 실청구액(오픈 할인가) 우선, 없으면 표시가 단일출처 폴백.
    const amountKrw = payInfo?.amount_krw ?? IAP_DISPLAY_PRICE_KRW.hapcard;
    return (
      <main style={{ minHeight: '100vh', padding: '32px 16px', backgroundColor: 'var(--bg-base)' }}>
        <div
          style={{
            borderRadius: 16,
            backgroundColor: 'color-mix(in srgb, var(--primary) 8%, transparent)',
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <p style={{ font: 'var(--t-h3)', margin: 0, color: 'var(--text-primary)' }}>
            케미카드는 ₩{amountKrw.toLocaleString()}이 필요해요
          </p>
          <p style={{ font: 'var(--t-sub)', margin: 0, color: 'var(--text-secondary)' }}>
            결제 후 바로 케미카드를 확인할 수 있어요.
          </p>
          {iapError && (
            <p style={{ font: 'var(--t-cap)', margin: 0, color: 'var(--destructive)' }}>
              결제 중 오류가 발생했어요. 다시 시도해 주세요.
            </p>
          )}
          <RefundRestrictionConsent checked={refundConsent} onCheckedChange={setRefundConsent} />
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              type="button"
              onClick={() => {
                clearIapError();
                if (payInfo) {
                  openIapPurchase(payInfo);
                }
              }}
              disabled={isPurchasing || !payInfo || !refundConsent}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: 10,
                border: 'none',
                backgroundColor: 'var(--primary)',
                color: 'white',
                fontSize: 14,
                fontWeight: 700,
                cursor: isPurchasing || !payInfo || !refundConsent ? 'not-allowed' : 'pointer',
                opacity: isPurchasing || !payInfo || !refundConsent ? 0.6 : 1,
              }}
            >
              {isPurchasing ? '결제 중…' : `₩${amountKrw.toLocaleString()} 결제하기`}
            </button>
            <button
              type="button"
              onClick={() => { clearIapError(); setPayDismissed(true); }}
              style={{
                padding: '10px 16px',
                borderRadius: 10,
                border: '1px solid var(--border)',
                backgroundColor: 'transparent',
                color: 'var(--text-primary)',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              닫기
            </button>
          </div>
        </div>
      </main>
    );
  }

  // 내 사주 없음
  if (isError && isUserChartMissingError(error)) {
    return (
      <main style={{ minHeight: '100vh', padding: '32px 16px', backgroundColor: 'var(--bg-base)' }}>
        <div
          style={{
            borderRadius: 16,
            backgroundColor: 'var(--bg-card)',
            padding: 24,
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <p style={{ font: 'var(--t-h3)', margin: 0, color: 'var(--text-primary)' }}>
            {t('errors.userChartMissing.title')}
          </p>
          <p style={{ font: 'var(--t-sub)', margin: 0, color: 'var(--text-secondary)' }}>
            {t('errors.userChartMissing.body')}
          </p>
          <button
            type="button"
            onClick={() => navigate('/onboarding')}
            style={{
              fontSize: 14,
              color: 'var(--primary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            {t('errors.userChartMissing.cta')}
          </button>
        </div>
      </main>
    );
  }

  // 인연 사주 계산 중
  if (isError && isRelationChartPendingError(error)) {
    return (
      <main style={{ minHeight: '100vh', padding: '32px 16px', backgroundColor: 'var(--bg-base)' }}>
        <div
          style={{
            borderRadius: 16,
            backgroundColor: 'var(--bg-card)',
            padding: 24,
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <p style={{ font: 'var(--t-h3)', margin: 0, color: 'var(--text-primary)' }}>
            {t('errors.chartPending.title')}
          </p>
          <p style={{ font: 'var(--t-sub)', margin: 0, color: 'var(--text-secondary)' }}>
            {t('errors.chartPending.body')}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, paddingTop: 4 }}>
            <button
              type="button"
              onClick={() => { void refetch(); }}
              style={{ fontSize: 14, fontWeight: 600, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >
              다시 시도
            </button>
            <button
              type="button"
              onClick={() => navigate('/feed')}
              style={{ fontSize: 14, fontWeight: 600, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >
              {t('errors.chartPending.cta')}
            </button>
          </div>
        </div>
      </main>
    );
  }

  // 그 외 에러
  if (isError) {
    return (
      <main style={{ minHeight: '100vh', padding: '32px 16px', backgroundColor: 'var(--bg-base)' }}>
        <ErrorCard code={getErrorCardCode(error)} onRetry={() => { void refetch(); }} />
      </main>
    );
  }

  // 로딩
  if (isLoading) {
    return (
      <main style={{ minHeight: '100vh', padding: '32px 16px', backgroundColor: 'var(--bg-base)' }}>
        <HapcardLoadingState />
      </main>
    );
  }

  if (!data?.visuals) {
    return (
      <main style={{ minHeight: '100vh', padding: '32px 16px', backgroundColor: 'var(--bg-base)' }}>
        <div style={{ borderRadius: 16, backgroundColor: 'var(--bg-card)', padding: 24, textAlign: 'center' }}>
          <p style={{ font: 'var(--t-sub)', color: 'var(--text-secondary)', margin: 0 }}>
            {t('placeholder')}
          </p>
        </div>
      </main>
    );
  }

  // ---------------------------------------------------------------------------
  // 데이터 파생
  // ---------------------------------------------------------------------------

  const { visuals } = data;
  const todayTemperature = scoreToTemperature(data.compat_score);
  const scenarioEstimate = data.score_breakdown?.scenario_estimate ?? null;
  const relationNickname = data.relation_nickname ?? '';
  const headerNote = `${relationNickname} · ${convertHanja(visuals.user.day_pillar)} ↔ ${convertHanja(visuals.relation.day_pillar)}`;
  const heroCoachLines = formatHeroCoachLines({
    mainText: data.content.main_text,
    whyCards: data.content.why_cards,
    actions: data.content.actions,
  });
  const actionItems = formatHapcardActionItems({
    mainText: data.content.main_text,
    whyCards: data.content.why_cards,
    actions: data.content.actions,
  });

  function openRenameDialog() {
    setRenameValue(relationNickname);
    setRenameError(null);
    setMenuOpen(false);
    setRenameOpen(true);
  }

  // 케미카드 공유 — 토스 네이티브 공유 시트. 사용자 취소/미지원은 조용히 무시.
  async function handleShare() {
    setMenuOpen(false);
    if (!id) return;
    try {
      await shareHapcard(id, token);
    } catch {
      // 사용자가 공유를 취소했거나 SDK 미지원 환경 — 별도 처리 없음.
    }
  }

  // ---------------------------------------------------------------------------
  // 렌더
  // ---------------------------------------------------------------------------

  return (
    <GlossaryProvider>
      {/* AppBar */}
      <header
        style={{
          position: 'relative',
          zIndex: 10,
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="back"
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: 'none',
            background: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            color: 'var(--text-primary)',
            cursor: 'pointer',
          }}
        >
          ‹
        </button>
        <span
          style={{
            font: 'var(--t-h3)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            padding: '0 8px',
          }}
        >
          {headerNote}
        </span>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="more"
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: 'none',
            background: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-primary)',
            cursor: 'pointer',
          }}
        >
          <MoreHorizontal style={{ width: 20, height: 20 }} />
        </button>
      </header>

      {/* ⋯ 메뉴 팝오버 */}
      {menuOpen && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 20 }}
            onClick={() => setMenuOpen(false)}
          />
          <div
            style={{
              position: 'absolute',
              top: 56,
              right: 16,
              zIndex: 30,
              backgroundColor: 'var(--bg-card)',
              borderRadius: 14,
              minWidth: 180,
              padding: 6,
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <button
              type="button"
              onClick={openRenameDialog}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 10,
                border: 'none',
                backgroundColor: 'transparent',
                textAlign: 'left',
                fontSize: 14,
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              <Edit2 style={{ width: 16, height: 16 }} /> {t('menu.rename')}
            </button>
            <button
              type="button"
              onClick={() => void handleShare()}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 10,
                border: 'none',
                backgroundColor: 'transparent',
                textAlign: 'left',
                fontSize: 14,
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              <Share2 style={{ width: 16, height: 16 }} /> {t('menu.share')}
            </button>
            <div style={{ height: 1, backgroundColor: 'var(--border)', margin: '2px 8px' }} />
            <button
              type="button"
              onClick={() => { setMenuOpen(false); setConfirmDel(true); }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 10,
                border: 'none',
                backgroundColor: 'transparent',
                textAlign: 'left',
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--destructive)',
                cursor: 'pointer',
              }}
            >
              <Trash2 style={{ width: 16, height: 16 }} /> {t('menu.delete')}
            </button>
          </div>
        </>
      )}

      <main
        style={{
          backgroundColor: 'var(--bg-base)',
          minHeight: '100vh',
          padding: '8px 16px 128px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* ── Liquid Glass 히어로 ── */}
        <section
          style={{
            background: 'var(--bg-liquid-hero, linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 70%, #1a1a2e) 100%))',
            borderRadius: 20,
            padding: 20,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <span
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background: 'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.30), transparent 50%)',
            }}
          />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                {String(t(`mode.${mode}` as Parameters<typeof t>[0]))} · {relationNickname}
              </p>
              <AiDisclosureBadge tone="dark" />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
              <span style={{ fontFamily: 'var(--font-display, sans-serif)', fontWeight: 900, fontSize: 72, lineHeight: 0.95, letterSpacing: '-0.04em', color: 'white' }}>
                {todayTemperature.toFixed(1)}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 18, fontWeight: 700 }}>°C</span>
              {scenarioEstimate && (
                <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: 700 }}>
                  ±{scoreDeltaToTemperatureDelta(scenarioEstimate.display_range).toFixed(1)}°C
                </span>
              )}
            </div>
            {scenarioEstimate && (
              <span
                style={{
                  display: 'inline-block',
                  marginTop: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  borderRadius: 100,
                  padding: '4px 10px',
                  backgroundColor: scenarioEstimate.needs_badge ? 'rgba(255,191,0,0.30)' : 'rgba(255,255,255,0.20)',
                  color: 'white',
                }}
              >
                {t('scenarioEstimate.badge')}
              </span>
            )}
            <div data-testid="hapcard-hero-main-text" style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10, color: 'white' }}>
              {heroCoachLines.map((line) => (
                <p
                  key={line.key}
                  data-testid={`hapcard-hero-line-${line.key}`}
                  style={{ fontSize: 16, lineHeight: 1.55, fontWeight: 600, color: 'rgba(255,255,255,0.95)', margin: 0 }}
                >
                  <strong style={{ fontWeight: 900, color: 'var(--p-10, rgba(255,255,255,0.9))' }}>{line.label}</strong>{' '}
                  <span>{easyText(line.body)}</span>
                </p>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
              {data.content.why_cards?.slice(0, 3).map((c, i) => (
                <span
                  key={i}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.20)',
                    color: 'white',
                    fontSize: 11,
                    fontWeight: 700,
                    lineHeight: 1.2,
                    borderRadius: 100,
                    padding: '6px 10px',
                  }}
                >
                  {c.title ?? c.summary ?? ''}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── 영역별 온도 (5축) ── */}
        {data.content.area_scores && (
          <section
            style={{
              borderRadius: 12,
              backgroundColor: 'var(--bg-card)',
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <p style={{ font: 'var(--t-eyebrow)', color: 'var(--primary)', margin: 0 }}>
              {t('areas.title')}
            </p>
            {(['talk', 'attract', 'speed', 'money', 'future'] as const).map((k) => {
              const v = data.content.area_scores?.[k] ?? 0;
              const color = v >= 70 ? 'var(--ok)' : v < 55 ? 'var(--warn)' : 'var(--primary)';
              return (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 48, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {t(`areas.${k}` as Parameters<typeof t>[0])}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      height: 6,
                      backgroundColor: 'var(--surface-1)',
                      borderRadius: 100,
                      overflow: 'hidden',
                    }}
                  >
                    <span
                      style={{
                        display: 'block',
                        height: '100%',
                        borderRadius: 100,
                        width: `${v}%`,
                        backgroundColor: color,
                      }}
                    />
                  </span>
                  <span style={{ width: 48, textAlign: 'right', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                    {scoreToTemperature(v).toFixed(1)}°
                  </span>
                </div>
              );
            })}
          </section>
        )}

        {/* ── 펼침 진입 버튼 ── */}
        <button
          type="button"
          aria-expanded={expandOpen}
          aria-controls="hapcard-expand-panel"
          onClick={() => setExpandOpen((o) => !o)}
          style={{
            width: '100%',
            borderRadius: 100,
            padding: '14px 0',
            fontWeight: 700,
            fontSize: 15,
            border: 'none',
            background: 'var(--p-90, color-mix(in srgb, var(--primary) 15%, white))',
            color: 'var(--p-10, var(--primary))',
            cursor: 'pointer',
          }}
        >
          {expandOpen ? t('expand.collapse') : t('expand.cta')}
        </button>

        {/* ── 인라인 펼침 패널: 5탭 ── */}
        {expandOpen && (
          <ExpandPanel
            data={data}
            mode={mode}
            tab={expandTab}
            onTab={setExpandTab}
            easyMode={easyMode}
            onToggleEasyMode={toggleEasyMode}
            token={token}
          />
        )}

        {/* ── 메인 CTA — 오늘의 조언 (ADR-016 13-섹션 잠금) ── */}
        <HapcardActions actions={actionItems} />

        {/* ── 케미 다시 맞추기 (핵심 기능) ── */}
        <HapcardReplayButton
          hapcardId={data.hapcard_id}
          relationId={data.relation_id}
          mode={mode}
          targetDate={targetDate}
        />

        {/* 푸터 면책 */}
        <p style={{ fontSize: 12, color: 'var(--outline)', textAlign: 'center', margin: 0, paddingTop: 4 }}>
          {t('footer.disclaimer')}
        </p>
      </main>

      {/* ── 별명 수정 다이얼로그 ── */}
      {renameOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            backgroundColor: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 24px',
          }}
          onClick={() => setRenameOpen(false)}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="hapcard-rename-title"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 20,
              padding: 20,
              width: '100%',
              maxWidth: 320,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              if (!canRename) return;
              rename.mutate({ id: id!, nickname: renameValue.trim() });
            }}
          >
            <div>
              <h2 id="hapcard-rename-title" style={{ font: 'var(--t-h3)', margin: '0 0 4px', color: 'var(--text-primary)' }}>
                {t('rename.title')}
              </h2>
              <p style={{ font: 'var(--t-sub)', margin: 0, color: 'var(--text-secondary)' }}>
                {t('rename.body')}
              </p>
            </div>
            <input
              id="hapcard-rename-input"
              value={renameValue}
              maxLength={20}
              aria-label={t('rename.label')}
              placeholder={t('rename.placeholder')}
              onChange={(e) => { setRenameValue(e.target.value); setRenameError(null); }}
              style={{
                width: '100%',
                borderRadius: 12,
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-base)',
                padding: '12px',
                fontSize: 16,
                fontWeight: 600,
                color: 'var(--text-primary)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {renameError && (
              <p role="alert" style={{ fontSize: 13, fontWeight: 600, color: 'var(--destructive)', margin: 0 }}>
                {renameError}
              </p>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setRenameOpen(false)}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  borderRadius: 12,
                  border: 'none',
                  backgroundColor: 'var(--surface-1)',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t('rename.cancel')}
              </button>
              <button
                type="submit"
                disabled={!canRename}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  borderRadius: 12,
                  border: 'none',
                  backgroundColor: 'var(--primary)',
                  color: 'white',
                  fontWeight: 700,
                  cursor: canRename ? 'pointer' : 'not-allowed',
                  opacity: canRename ? 1 : 0.6,
                }}
              >
                {rename.isPending ? t('rename.saving') : t('rename.save')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── 삭제 확인 ── */}
      {confirmDel && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            backgroundColor: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 24px',
          }}
          onClick={() => setConfirmDel(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 20,
              padding: 20,
              width: '100%',
              maxWidth: 320,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ font: 'var(--t-h3)', margin: 0, color: 'var(--text-primary)' }}>
              {t('delete.confirmTitle', { nickname: relationNickname })}
            </p>
            <p style={{ font: 'var(--t-sub)', margin: 0, color: 'var(--text-secondary)' }}>
              {t('delete.confirmBody')}
            </p>
            <div style={{ display: 'flex', gap: 8, paddingTop: 8 }}>
              <button
                type="button"
                onClick={() => setConfirmDel(false)}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  borderRadius: 12,
                  border: 'none',
                  backgroundColor: 'var(--surface-1)',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t('delete.cancel')}
              </button>
              <button
                type="button"
                onClick={() => { setConfirmDel(false); del.mutate(); }}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  borderRadius: 12,
                  border: 'none',
                  backgroundColor: 'var(--destructive)',
                  color: 'white',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {t('delete.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 삭제 완료 토스트 ── */}
      {deleted && (
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 50,
            backgroundColor: 'rgba(0,0,0,0.85)',
            color: 'white',
            padding: '14px 20px',
            borderRadius: 14,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Check style={{ width: 18, height: 18 }} /> {t('delete.done')}
        </div>
      )}

      <GlossarySheet />
    </GlossaryProvider>
  );
}

// ---------------------------------------------------------------------------
// 펼침 패널 — 5탭
// ---------------------------------------------------------------------------

function ExpandPanel({
  data,
  mode,
  tab,
  onTab,
  easyMode,
  onToggleEasyMode,
  token,
}: {
  data: HapcardResult;
  /** 탭별 API 라우트 (ohaeng/area/flow) 전달 */
  mode: string;
  tab: ExpandTab;
  onTab: (t: ExpandTab) => void;
  easyMode: boolean;
  onToggleEasyMode: () => void;
  token?: string | null;
}) {
  const t = useTranslations('hapcard.expand');
  const easy = (text: string) => (easyMode ? toEasyText(text) : text);
  const summaryLines = formatDetailSummaryLines(data.content.main_text);
  const causeFactors = (data.content.cause_factors ?? []).map((f) =>
    easyMode ? { ...f, name: toEasyText(f.name), effect: toEasyText(f.effect) } : f,
  );

  const tabs: { k: ExpandTab; label: string }[] = [
    { k: 'summary', label: String(t('tab.summary')) },
    { k: 'ohaeng', label: String(t('tab.ohaeng')) },
    { k: 'evidence', label: String(t('tab.evidence')) },
    { k: 'area', label: String(t('tab.area')) },
    { k: 'flow', label: String(t('tab.flow')) },
  ];

  return (
    <section
      id="hapcard-expand-panel"
      aria-labelledby="hapcard-expand-panel-title"
      data-testid="hapcard-expand-panel"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 20,
        overflow: 'hidden',
      }}
    >
      <header
        style={{
          padding: '16px 16px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <h2
          id="hapcard-expand-panel-title"
          style={{ font: 'var(--t-h2)', color: 'var(--text-primary)', margin: 0 }}
        >
          {t('title')}
        </h2>
        {/* G-5 쉽게 보기 토글 */}
        <button
          type="button"
          role="switch"
          aria-checked={easyMode}
          aria-label={String(t('easyMode.label'))}
          onClick={onToggleEasyMode}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            borderRadius: 100,
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 700,
            border: easyMode ? 'none' : '1px solid var(--border)',
            backgroundColor: easyMode ? 'var(--primary)' : 'var(--surface-1)',
            color: easyMode ? 'white' : 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          {t('easyMode.label')}
        </button>
      </header>

      {/* 탭 내비 */}
      <nav
        style={{
          display: 'flex',
          gap: 2,
          backgroundColor: 'var(--surface-1)',
          borderRadius: 12,
          padding: 3,
          margin: '0 16px 12px',
        }}
      >
        {tabs.map((tb) => (
          <button
            key={tb.k}
            type="button"
            onClick={() => onTab(tb.k)}
            style={{
              flex: 1,
              padding: '10px 0',
              borderRadius: 9,
              fontSize: 12,
              fontWeight: tab === tb.k ? 800 : 600,
              border: 'none',
              backgroundColor: tab === tb.k ? 'var(--bg-card)' : 'transparent',
              color: tab === tb.k ? 'var(--primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              boxShadow: tab === tb.k ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {tb.label}
          </button>
        ))}
      </nav>

      <div style={{ padding: '0 16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* 요약 탭 */}
        {tab === 'summary' && (
          <div data-testid="hapcard-expand-summary-text" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {summaryLines.map((line) => (
              <p
                key={line.key}
                data-testid={`hapcard-expand-summary-line-${line.key}`}
                style={{ fontSize: 15, lineHeight: 1.75, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}
              >
                <strong style={{ fontWeight: 900, color: 'var(--primary)' }}>{line.label}</strong>
                <span aria-hidden style={{ fontWeight: 900, color: 'var(--primary)' }}> = </span>
                <span>{easy(line.body)}</span>
              </p>
            ))}
          </div>
        )}

        {/* 오행 탭 (ADR-016) */}
        {tab === 'ohaeng' && (
          <HapcardOhaeng
            hapcardId={data.hapcard_id}
            userCounts={data.visuals!.user.five_elements_counts}
            relationCounts={data.visuals!.relation.five_elements_counts}
            interpretation={data.content.ohaeng_interpretation}
            token={token}
          />
        )}

        {/* 근거 탭 (ADR-015/016) */}
        {tab === 'evidence' && (
          <>
            {/* H-2 변화 폭 인디케이터 (ADR-033/036) */}
            <HapcardChangeIndicator hapcardId={data.hapcard_id} token={token} />
            <HapcardCauseFactors factors={causeFactors} />
            <HapcardEvidence cards={data.content.why_cards} />
            <HapcardClassic citations={data.content.classic_citation} />
          </>
        )}

        {/* 영역 탭 — 역할 분석 */}
        {tab === 'area' && (
          <HapcardRoleAnalysis
            hapcardId={data.hapcard_id}
            analysis={data.content.role_analysis}
            token={token}
          />
        )}

        {/* 흐름 탭 — 7일 합온도 타임라인 (ADR-033/036) */}
        {tab === 'flow' && (
          <HapcardTimeline hapcardId={data.hapcard_id} mode={mode} token={token} />
        )}
      </div>
    </section>
  );
}
