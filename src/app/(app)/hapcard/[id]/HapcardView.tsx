'use client';

/* HapcardView — canvas Type D 패턴
 * Canvas reference: type-d/screens-interactive.jsx::IHapcard + IHapcardExpand (sheet)
 *
 * Before: 12+ 컴포넌트가 일렬로 — Header → Gauge → Conclusion → Body → Highlights → Ohaeng → MiniRadar → Timeline → Evidence → Actions → Classic → Replay → Footer
 * After:
 *   메인: Liquid Glass hero(점수+결론+영역바) + 강점/주의 2분할 + CTA
 *   ⋯ 메뉴: 별명 수정 / 공유 / 인연 삭제 (확인 다이얼로그)
 *   "펼침" sheet: 요약 · 오행 · 근거 · 영역 · 흐름 5탭
 */

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, Trash2, Edit2, Share2, Check, X } from 'lucide-react';

import { DEFAULT_THEORY_PROFILE_VERSION } from '@/types/chart';
import type { HapcardResult, HapcardErrorCode } from '@/types/hapcard';

import { HapcardOhaeng } from '@/components/hapcard/ohaeng';
import { HapcardMiniRadar } from '@/components/hapcard/mini-radar';
import { HapcardEvidence } from '@/components/hapcard/evidence';
import { HapcardActions } from '@/components/hapcard/actions';
import { HapcardClassic } from '@/components/hapcard/classic';
import { HapcardTimeline } from '@/components/hapcard/timeline';
import { HapcardReplayButton } from '@/components/hapcard/replay-button';
import { HapcardShare } from '@/components/hapcard/share';
import { GlossaryProvider } from '@/components/hapcard/glossary-provider';
import { GlossarySheet } from '@/components/hapcard/glossary-sheet';

const CHART_PENDING_CODES: HapcardErrorCode[] = ['RELATION_CHART_NOT_FOUND', 'USER_CHART_NOT_FOUND'];

async function callHapcard(relationId: string, mode: string): Promise<HapcardResult> {
  const res = await fetch('/api/hapcards', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ relation_id: relationId, mode, theory_profile_version: DEFAULT_THEORY_PROFILE_VERSION }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const code: HapcardErrorCode = body?.error?.code ?? 'INTERNAL_ERROR';
    throw Object.assign(new Error(code), { code });
  }
  return res.json() as Promise<HapcardResult>;
}

async function deleteRelation(id: string) {
  const res = await fetch(`/api/relations/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('DELETE_FAILED');
}

function isChartPendingError(e: unknown): boolean {
  const code = (e as { code?: string })?.code;
  return CHART_PENDING_CODES.includes(code as HapcardErrorCode);
}

type ExpandTab = 'summary' | 'ohaeng' | 'evidence' | 'area' | 'flow';

export default function HapcardView() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const mode = sp.get('mode');
  const router = useRouter();
  const qc = useQueryClient();
  const t = useTranslations('hapcard');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['hapcard', id, mode],
    queryFn: () => callHapcard(id, mode!),
    enabled: !!mode, retry: false,
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [expandOpen, setExpandOpen] = useState(false);
  const [expandTab, setExpandTab] = useState<ExpandTab>('summary');
  const [deleted, setDeleted] = useState(false);

  const del = useMutation({
    mutationFn: deleteRelation,
    onSuccess: () => {
      setDeleted(true);
      qc.invalidateQueries({ queryKey: ['feed'] });
      qc.invalidateQueries({ queryKey: ['relations'] });
    },
  });

  // 삭제 완료 후 1초 뒤 피드로
  useEffect(() => {
    if (deleted) {
      const t = setTimeout(() => router.push('/feed'), 900);
      return () => clearTimeout(t);
    }
  }, [deleted, router]);

  if (!mode || (isError && !isChartPendingError(error))) {
    return (
      <main className="bg-background min-h-screen px-4 pt-8">
        <p className="font-sub text-destructive text-center py-8">{t('errors.generic')}</p>
      </main>
    );
  }

  if (isError && isChartPendingError(error)) {
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
        <div data-testid="hapcard-skeleton" className="space-y-3 animate-pulse">
          <div className="h-10 rounded-2xl bg-card" />
          <div className="h-40 rounded-2xl bg-card" />
          <div className="h-24 rounded-2xl bg-card" />
        </div>
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
  const headerNote = `${data.relation_nickname} · ${visuals.user.day_pillar} ↔ ${visuals.relation.day_pillar}`;

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
        {/* ── Liquid Glass hero: 점수 + 결론 + 강점/주의 ── */}
        <section className="bg-liquid-hero rounded-[var(--r-xl)] p-5 relative overflow-hidden">
          <span aria-hidden className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.30), transparent 50%)' }} />
          <div className="relative z-[1]">
            <p className="text-[11px] font-bold text-white/85 uppercase tracking-[0.08em]">
              {t(`mode.${mode}` as never)} · {data.relation_nickname}
            </p>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="font-display font-black text-[72px] leading-[0.95] tracking-[-0.04em] text-white tabular-nums">
                {data.compat_score}
              </span>
              <span className="text-white/85 text-sm">/100</span>
            </div>
            <p className="font-h2 text-white mt-3 whitespace-pre-line">{data.content.main_text.split('\n').slice(0, 2).join('\n')}</p>
            <div className="flex gap-1.5 mt-3 flex-wrap">
              {data.content.why_cards?.slice(0, 3).map((c, i) => (
                <span key={i} className="bg-white/20 text-white text-[11px] font-bold leading-[1.2] rounded-full px-2.5 py-1.5">
                  {c.title ?? c.summary ?? ''}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── 영역별 합 (5축) ── */}
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
                  <span className="w-6 text-right font-display font-bold text-[13px] text-foreground tabular-nums">{v}</span>
                </div>
              );
            })}
          </section>
        )}

        {/* ── 펼침 진입 버튼 ── */}
        <button
          onClick={() => setExpandOpen(true)}
          className="w-full rounded-[var(--r-pill)] py-3.5 font-bold text-[15px] active:scale-[0.99] transition-transform"
          style={{ background: 'var(--p-90)', color: 'var(--p-10)' }}>
          {t('expand.cta')}
        </button>

        {/* ── 메인 CTA — "일단 이거 해봐" ── */}
        <HapcardActions actions={data.content.actions} />

        {/* ── 다시합 ── */}
        <HapcardReplayButton hapcardId={data.hapcard_id} mode={mode!} />
      </main>

      {/* ── 펼침 sheet: 5탭 ── */}
      {expandOpen && (
        <ExpandSheet
          data={data}
          mode={mode!}
          tab={expandTab}
          onTab={setExpandTab}
          onClose={() => setExpandOpen(false)}
        />
      )}

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

/* ── 펼침 sheet — 5개 탭 안에 기존 컴포넌트 재사용 ── */
function ExpandSheet({
  data, mode, tab, onTab, onClose,
}: {
  data: HapcardResult;
  mode: string;
  tab: ExpandTab;
  onTab: (t: ExpandTab) => void;
  onClose: () => void;
}) {
  const t = useTranslations('hapcard.expand');
  const tabs: { k: ExpandTab; label: string }[] = [
    { k: 'summary', label: t('tab.summary') },
    { k: 'ohaeng', label: t('tab.ohaeng') },
    { k: 'evidence', label: t('tab.evidence') },
    { k: 'area', label: t('tab.area') },
    { k: 'flow', label: t('tab.flow') },
  ];

  return (
    <div className="fixed inset-0 z-40 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 animate-in fade-in" />
      <div
        className="relative w-full bg-background rounded-t-[28px] max-h-[90vh] flex flex-col animate-in slide-in-from-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <span aria-hidden className="w-9 h-1 rounded-full bg-border mx-auto mt-2 mb-1" />
        <header className="flex items-center justify-between px-4 py-2">
          <h2 className="font-h2 text-foreground">{t('title')}</h2>
          <button onClick={onClose} aria-label="close"
            className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center">
            <X size={18} />
          </button>
        </header>
        <nav className="flex gap-0.5 bg-[var(--surface-1)] rounded-[12px] p-[3px] mx-4 mb-3">
          {tabs.map(tb => (
            <button key={tb.k} onClick={() => onTab(tb.k)}
              className={`flex-1 py-2.5 rounded-[9px] text-[12px] font-semibold transition ${
                tab === tb.k
                  ? 'bg-[var(--surface)] text-primary shadow-[var(--e-1)] font-extrabold'
                  : 'text-muted-foreground'
              }`}>
              {tb.label}
            </button>
          ))}
        </nav>
        <div className="flex-1 overflow-auto px-4 pb-8 space-y-3">
          {tab === 'summary' && (
            <p className="font-h2 text-foreground whitespace-pre-line">{data.content.main_text}</p>
          )}
          {tab === 'ohaeng' && (
            <HapcardOhaeng
              userCounts={data.visuals!.user.five_elements_counts}
              relationCounts={data.visuals!.relation.five_elements_counts}
            />
          )}
          {tab === 'evidence' && (
            <>
              <HapcardEvidence cards={data.content.why_cards} />
              <HapcardClassic citations={data.content.classic_citation} />
            </>
          )}
          {tab === 'area' && (
            <HapcardMiniRadar
              user={data.visuals!.user.five_elements_counts}
              relation={data.visuals!.relation.five_elements_counts}
            />
          )}
          {tab === 'flow' && (
            <HapcardTimeline hapcardId={data.hapcard_id} mode={mode} />
          )}
        </div>
      </div>
    </div>
  );
}
