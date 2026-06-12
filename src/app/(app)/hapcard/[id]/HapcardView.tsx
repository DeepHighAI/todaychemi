'use client';

/* HapcardView — canvas Type D 패턴
 * Canvas reference: type-d/screens-interactive.jsx::IHapcard + IHapcardExpand (sheet)
 *
 * Before: 12+ 컴포넌트가 일렬로 — Header → Gauge → Conclusion → Body → Highlights → Ohaeng → MiniRadar → Timeline → Evidence → Actions → Classic → Replay → Footer
 * After:
 *   메인: Liquid Glass hero(점수+결론+영역바) + 강점/주의 2분할 + CTA
 *   ⋯ 메뉴: 별명 수정 / 공유 / 인연 삭제 (확인 다이얼로그)
 *   "펼침" panel: 요약 · 오행 · 근거 · 영역 · 흐름 5탭
 */

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, Trash2, Edit2, Share2, Check } from 'lucide-react';

import { trackEvent } from '@/lib/analytics/ga';
import { DEFAULT_THEORY_PROFILE_VERSION } from '@/types/chart';
import type { HapcardResult, HapcardErrorCode } from '@/types/hapcard';

import { HapcardOhaeng } from '@/components/hapcard/ohaeng';
import { HapcardRoleAnalysis } from '@/components/hapcard/role-analysis';
import { HapcardEvidence } from '@/components/hapcard/evidence';
import { HapcardCauseFactors } from '@/components/hapcard/cause-factors';
import { HapcardActions } from '@/components/hapcard/actions';
import { HapcardClassic } from '@/components/hapcard/classic';
import { HapcardTimeline } from '@/components/hapcard/timeline';
import { HapcardLoadingState } from '@/components/hapcard/loading-state';
import { HapcardReplayButton } from '@/components/hapcard/replay-button';
import { HapcardShare } from '@/components/hapcard/share';
import { FeaturePaySheet } from '@/components/payments/feature-pay-sheet';
import { GlossaryProvider } from '@/components/hapcard/glossary-provider';
import { GlossarySheet } from '@/components/hapcard/glossary-sheet';
import { AiDisclosureBadge } from '@/components/ai-disclosure/ai-disclosure-badge';
import { convertHanja } from '@/lib/glossary/post-process';
import { formatDetailSummaryLines, formatHapcardActionItems, formatHeroCoachLines } from '@/lib/hapcard/hero-main-text';
import { scoreToTemperature } from '@/lib/scoring/temperature';
import { todayKST } from '@/lib/today/kst-date';

const RELATION_CHART_PENDING_CODES: HapcardErrorCode[] = ['RELATION_CHART_NOT_FOUND'];

async function callHapcard(relationId: string, mode: string): Promise<HapcardResult> {
  const res = await fetch('/api/hapcards', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ relation_id: relationId, mode, theory_profile_version: DEFAULT_THEORY_PROFILE_VERSION }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const code: HapcardErrorCode = body?.error?.code ?? 'INTERNAL_ERROR';
    // 402 PAYMENT_REQUIRED 는 결제 시트에 필요한 ref/amount 를 함께 실어 보낸다.
    throw Object.assign(new Error(code), {
      code,
      feature: body?.feature,
      ref: body?.ref,
      amount_krw: body?.amount_krw,
    });
  }
  return res.json() as Promise<HapcardResult>;
}

async function deleteRelation(id: string) {
  const res = await fetch(`/api/relations/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('DELETE_FAILED');
}

function getErrorCode(e: unknown): HapcardErrorCode | undefined {
  return (e as { code?: HapcardErrorCode })?.code;
}

function isUserChartMissingError(e: unknown): boolean {
  return getErrorCode(e) === 'USER_CHART_NOT_FOUND';
}

function isRelationChartPendingError(e: unknown): boolean {
  const code = (e as { code?: string })?.code;
  return RELATION_CHART_PENDING_CODES.includes(code as HapcardErrorCode);
}

function getPaymentRef(e: unknown): string | null {
  const ref = (e as { ref?: unknown })?.ref;
  return typeof ref === 'string' && ref.length > 0 ? ref : null;
}

type ExpandTab = 'summary' | 'ohaeng' | 'evidence' | 'area' | 'flow';

export default function HapcardView() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const mode = sp.get('mode');
  const router = useRouter();
  const qc = useQueryClient();
  const t = useTranslations('hapcard');
  const targetDate = todayKST();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['hapcard', id, mode, targetDate],
    queryFn: () => callHapcard(id, mode!),
    enabled: !!mode, retry: false,
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [expandOpen, setExpandOpen] = useState(false);
  const [expandTab, setExpandTab] = useState<ExpandTab>('summary');
  const [deleted, setDeleted] = useState(false);
  const [payDismissed, setPayDismissed] = useState(false);

  const del = useMutation({
    mutationFn: deleteRelation,
    onSuccess: () => {
      setDeleted(true);
      qc.invalidateQueries({ queryKey: ['feed'] });
      qc.invalidateQueries({ queryKey: ['relations'] });
      qc.invalidateQueries({ queryKey: ['today'] });
    },
  });

  // 삭제 완료 후 1초 뒤 피드로
  useEffect(() => {
    if (deleted) {
      const t = setTimeout(() => router.push('/feed'), 900);
      return () => clearTimeout(t);
    }
  }, [deleted, router]);

  // G-8: 케미카드 도달 퍼널 이벤트 — 성공 데이터 확보 시 1회
  useEffect(() => {
    if (data && mode) trackEvent({ name: 'hapcard_view', params: { mode } });
  }, [data, mode]);

  // 402 PAYMENT_REQUIRED → 결제 시트 (generic 에러 분기보다 먼저 가로채기). 닫으면 generic fallback.
  const payErr = error as { code?: string; ref?: string } | null;
  const payRef = getPaymentRef(error);
  if (isError && payErr?.code === 'PAYMENT_REQUIRED' && payRef && mode && !payDismissed) {
    return (
      <FeaturePaySheet
        feature="hapcard"
        featureRef={payRef}
        next={`/hapcard/${id}?mode=${mode}`}
        open
        onOpenChange={(o) => {
          if (!o) setPayDismissed(true);
        }}
        onPaid={() => refetch()}
      />
    );
  }

  if (!mode || (isError && !isUserChartMissingError(error) && !isRelationChartPendingError(error))) {
    return (
      <main className="bg-background min-h-screen px-4 pt-8">
        <p className="font-sub text-destructive text-center py-8">{t('errors.generic')}</p>
      </main>
    );
  }

  if (isError && isUserChartMissingError(error)) {
    return (
      <main className="bg-background min-h-screen px-4 pt-8">
        <div className="rounded-2xl bg-card p-6 text-center space-y-3">
          <p className="font-h3 text-foreground">{t('errors.userChartMissing.title')}</p>
          <p className="font-sub text-muted-foreground">{t('errors.userChartMissing.body')}</p>
          <Link href="/onboarding" className="inline-block text-sm text-primary underline">
            {t('errors.userChartMissing.cta')}
          </Link>
        </div>
      </main>
    );
  }

  if (isError && isRelationChartPendingError(error)) {
    return (
      <main className="bg-background min-h-screen px-4 pt-8">
        <div className="rounded-2xl bg-card p-6 text-center space-y-3">
          <p className="font-h3 text-foreground">{t('errors.chartPending.title')}</p>
          <p className="font-sub text-muted-foreground">{t('errors.chartPending.body')}</p>
          <Link href="/feed" className="inline-block text-sm text-primary underline">
            {t('errors.chartPending.cta')}
          </Link>
        </div>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="bg-background min-h-screen px-4 pt-8">
        <HapcardLoadingState />
      </main>
    );
  }

  if (!data?.visuals) {
    return (
      <main className="bg-background min-h-screen px-4 pt-8">
        <div className="rounded-2xl bg-card p-6 text-center">
          <p className="font-sub text-muted-foreground">{t('placeholder')}</p>
        </div>
      </main>
    );
  }

  const { visuals } = data;
  const todayTemperature = scoreToTemperature(data.compat_score);
  const headerNote = `${data.relation_nickname} · ${convertHanja(visuals.user.day_pillar)} ↔ ${convertHanja(visuals.relation.day_pillar)}`;
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

  return (
    <GlossaryProvider>
      {/* 상단 AppBar — 좌: 뒤로 / 우: ⋯ */}
      <header className="appbar relative z-10 px-3 pt-2 flex items-center justify-between">
        <button onClick={() => router.back()} aria-label="back"
          className="w-8 h-8 rounded-full flex items-center justify-center text-foreground text-[22px] active:opacity-60">‹</button>
        <span className="font-h3 truncate px-2">{headerNote}</span>
        <button
          onClick={() => setMenuOpen(v => !v)}
          aria-label="more"
          className="w-8 h-8 rounded-full flex items-center justify-center text-foreground active:bg-muted">
          <MoreHorizontal size={20} />
        </button>
      </header>

      {/* ⋯ popover */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
          <div className="absolute top-14 right-4 z-30 bg-card rounded-[14px] min-w-[180px] p-1.5 shadow-xl border border-border space-y-0.5">
            <button className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-left text-[14px] text-foreground hover:bg-muted">
              <Edit2 size={16} /> {t('menu.rename')}
            </button>
            <button onClick={() => { setMenuOpen(false); setShareOpen(true); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-left text-[14px] text-foreground hover:bg-muted">
              <Share2 size={16} /> {t('menu.share')}
            </button>
            <div className="h-px bg-border mx-2 my-1" />
            <button onClick={() => { setMenuOpen(false); setConfirmDel(true); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-left text-[14px] font-semibold text-destructive hover:bg-destructive/10">
              <Trash2 size={16} /> {t('menu.delete')}
            </button>
          </div>
        </>
      )}

      <main className="bg-background min-h-screen px-4 pt-2 pb-32 space-y-3">
        {/* ── Liquid Glass hero: 케미온도 + 결론 + 강점/주의 ── */}
        <section className="bg-liquid-hero rounded-[var(--r-xl)] p-5 relative overflow-hidden">
          <span aria-hidden className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.30), transparent 50%)' }} />
          <div className="relative z-[1]">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] font-bold text-white/85 uppercase tracking-[0.08em]">
                {t(`mode.${mode}` as never)} · {data.relation_nickname}
              </p>
              <AiDisclosureBadge tone="dark" />
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="font-display font-black text-[72px] leading-[0.95] tracking-[-0.04em] text-white tabular-nums">
                {todayTemperature.toFixed(1)}
              </span>
              <span className="text-white/85 text-[18px] font-bold">°C</span>
            </div>
            <div data-testid="hapcard-hero-main-text" className="mt-4 space-y-2.5 text-white">
              {heroCoachLines.map(line => (
                <p
                  key={line.key}
                  data-testid={`hapcard-hero-line-${line.key}`}
                  className="text-[16px] leading-[1.55] font-semibold text-white/95"
                >
                  <strong className="font-black text-[var(--p-10)] drop-shadow-sm">{line.label}</strong>{' '}
                  <span>{line.body}</span>
                </p>
              ))}
            </div>
            <div className="flex gap-1.5 mt-3 flex-wrap">
              {data.content.why_cards?.slice(0, 3).map((c, i) => (
                <span key={i} className="bg-white/20 text-white text-[11px] font-bold leading-[1.2] rounded-full px-2.5 py-1.5">
                  {c.title ?? c.summary ?? ''}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── 영역별 온도 (5축) ── */}
        {data.content.area_scores && (
          <section className="rounded-[var(--r-md)] bg-card p-3.5 space-y-2.5">
            <p className="font-eyebrow text-primary">{t('areas.title')}</p>
            {(['talk', 'attract', 'speed', 'money', 'future'] as const).map((k) => {
              const v = data.content.area_scores?.[k] ?? 0;
              const color = v >= 70 ? 'var(--ok)' : v < 55 ? 'var(--warn)' : 'var(--p-40)';
              return (
                <div key={k} className="flex items-center gap-2.5">
                  <span className="w-12 text-[12px] font-semibold text-muted-foreground">{t(`areas.${k}`)}</span>
                  <span className="flex-1 h-1.5 bg-[var(--surface-1)] rounded-full overflow-hidden">
                    <span className="block h-full rounded-full" style={{ width: `${v}%`, background: color }} />
                  </span>
                  <span className="w-12 text-right font-display font-bold text-[13px] text-foreground tabular-nums">
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
          onClick={() => setExpandOpen(open => !open)}
          className="w-full rounded-[var(--r-pill)] py-3.5 font-bold text-[15px] active:scale-[0.99] transition-transform"
          style={{ background: 'var(--p-90)', color: 'var(--p-10)' }}>
          {expandOpen ? t('expand.collapse') : t('expand.cta')}
        </button>

        {/* ── 인라인 펼침 panel: 5탭 ── */}
        {expandOpen && (
          <ExpandPanel
            data={data}
            mode={mode!}
            tab={expandTab}
            onTab={setExpandTab}
          />
        )}

        {/* ── 메인 CTA — "일단 이거 해봐" ── */}
        <HapcardActions actions={actionItems} />

        {/* ── 케미 다시 맞추기 ── */}
        <HapcardReplayButton
          hapcardId={data.hapcard_id}
          relationId={data.relation_id}
          mode={mode!}
          targetDate={targetDate}
        />
      </main>

      {/* ── 삭제 확인 ── */}
      {confirmDel && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center px-6"
          onClick={() => setConfirmDel(false)}>
          <div className="bg-card rounded-[20px] p-5 w-full max-w-[320px] space-y-3"
            onClick={(e) => e.stopPropagation()}>
            <p className="font-h3 text-foreground">{t('delete.confirmTitle', { nickname: data.relation_nickname ?? '' })}</p>
            <p className="font-sub text-muted-foreground">{t('delete.confirmBody')}</p>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setConfirmDel(false)}
                className="flex-1 py-3 rounded-[12px] bg-muted text-foreground font-semibold">{t('delete.cancel')}</button>
              <button onClick={() => { setConfirmDel(false); del.mutate(id); }}
                className="flex-1 py-3 rounded-[12px] bg-destructive text-white font-bold">{t('delete.confirm')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 삭제 완료 toast ── */}
      {deleted && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-black/85 text-white px-5 py-3.5 rounded-[14px] font-semibold flex items-center gap-2">
          <Check size={18} /> {t('delete.done')}
        </div>
      )}

      <HapcardShare
        hapcardId={data.hapcard_id} mode={mode!}
        nickname={data.relation_nickname} score={data.compat_score}
        genderNormalized={data.relation_gender_normalized}
        visuals={visuals} open={shareOpen} onOpenChange={setShareOpen} />
      <GlossarySheet />
    </GlossaryProvider>
  );
}

/* ── 인라인 펼침 panel — 5개 탭 안에 기존 컴포넌트 재사용 ── */
function ExpandPanel({
  data, mode, tab, onTab,
}: {
  data: HapcardResult;
  mode: string;
  tab: ExpandTab;
  onTab: (t: ExpandTab) => void;
}) {
  const t = useTranslations('hapcard.expand');
  const summaryLines = formatDetailSummaryLines(data.content.main_text);
  const tabs: { k: ExpandTab; label: string }[] = [
    { k: 'summary', label: t('tab.summary') },
    { k: 'ohaeng', label: t('tab.ohaeng') },
    { k: 'evidence', label: t('tab.evidence') },
    { k: 'area', label: t('tab.area') },
    { k: 'flow', label: t('tab.flow') },
  ];

  return (
    <section
      id="hapcard-expand-panel"
      aria-labelledby="hapcard-expand-panel-title"
      data-testid="hapcard-expand-panel"
      className="bg-card border border-border rounded-[var(--r-xl)] overflow-hidden shadow-[var(--e-1)] animate-in fade-in slide-in-from-top-2"
    >
      <header className="px-4 pt-4 pb-3">
        <h2 id="hapcard-expand-panel-title" className="font-h2 text-foreground">{t('title')}</h2>
      </header>
      <nav className="flex gap-0.5 bg-[var(--surface-1)] rounded-[12px] p-[3px] mx-4 mb-3">
        {tabs.map(tb => (
          <button key={tb.k} type="button" onClick={() => onTab(tb.k)}
            className={`flex-1 py-2.5 rounded-[9px] text-[12px] font-semibold transition ${
              tab === tb.k
                ? 'bg-[var(--surface)] text-primary shadow-[var(--e-1)] font-extrabold'
                : 'text-muted-foreground'
            }`}>
            {tb.label}
          </button>
        ))}
      </nav>
      <div className="px-4 pb-5 space-y-3">
        {tab === 'summary' && (
          <div data-testid="hapcard-expand-summary-text" className="space-y-4">
            {summaryLines.map(line => (
              <p
                key={line.key}
                data-testid={`hapcard-expand-summary-line-${line.key}`}
                className="text-[15px] leading-[1.75] font-semibold text-foreground"
              >
                <strong className="font-black text-primary">{line.label}</strong>
                <span aria-hidden className="font-black text-primary"> = </span>
                <span>{line.body}</span>
              </p>
            ))}
          </div>
        )}
        {tab === 'ohaeng' && (
          <HapcardOhaeng
            hapcardId={data.hapcard_id}
            userCounts={data.visuals!.user.five_elements_counts}
            relationCounts={data.visuals!.relation.five_elements_counts}
            interpretation={data.content.ohaeng_interpretation}
          />
        )}
        {tab === 'evidence' && (
          <>
            <HapcardCauseFactors factors={data.content.cause_factors ?? []} />
            <HapcardEvidence cards={data.content.why_cards} />
            <HapcardClassic citations={data.content.classic_citation} />
          </>
        )}
        {tab === 'area' && (
          <HapcardRoleAnalysis hapcardId={data.hapcard_id} analysis={data.content.role_analysis} />
        )}
        {tab === 'flow' && (
          <HapcardTimeline hapcardId={data.hapcard_id} mode={mode} />
        )}
      </div>
    </section>
  );
}
