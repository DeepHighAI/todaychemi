import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { PenLine, ShieldCheck, Sparkles } from 'lucide-react';

import {
  advanceStreak,
  buildDailyTalisman,
  dailyTalismanStorageKey,
  DAILY_TALISMAN_STREAK_KEY,
  type DailyTalismanStatus,
  type DailyTalismanStreak,
} from '@/lib/today/daily-talisman';
import { trackTalismanEvent } from '@/lib/analytics/ait-analytics';
import type { ChartCore } from '@/types/chart';

interface DailyTalismanRitualProps {
  chart: ChartCore;
  todayDate: string;
}

const MIN_DRAW_MARKS = 10;
// 키보드 1회 입력당 가산 마크 — 5회로 완성(MIN_DRAW_MARKS/STEP)되도록.
const KEY_MARK_STEP = 2;
const GLYPH_TOAST_MS = 1800;
const GATHER_EFFECT_MS = 960;
const SEAL_EFFECT_MS = 1280;

const GATHER_PARTICLES = [
  { x: '-116px', y: '-54px', size: 7, delay: '0ms' },
  { x: '-82px', y: '62px', size: 5, delay: '45ms' },
  { x: '-34px', y: '-86px', size: 6, delay: '90ms' },
  { x: '48px', y: '-76px', size: 5, delay: '135ms' },
  { x: '96px', y: '42px', size: 7, delay: '180ms' },
  { x: '122px', y: '-18px', size: 4, delay: '225ms' },
  { x: '-126px', y: '16px', size: 4, delay: '270ms' },
  { x: '12px', y: '88px', size: 6, delay: '315ms' },
] as const;

const SEAL_PARTICLES = [
  { x: '-72px', y: '-30px', size: 5, delay: '0ms' },
  { x: '-54px', y: '42px', size: 4, delay: '60ms' },
  { x: '-12px', y: '-66px', size: 6, delay: '110ms' },
  { x: '38px', y: '-50px', size: 4, delay: '160ms' },
  { x: '70px', y: '22px', size: 5, delay: '210ms' },
  { x: '20px', y: '60px', size: 4, delay: '260ms' },
] as const;

function TalismanGatherEffect() {
  return (
    <span
      aria-hidden="true"
      className="talisman-gather"
      data-testid="talisman-gather-effect"
    >
      {GATHER_PARTICLES.map((particle, index) => (
        <span
          key={`${particle.x}:${particle.y}`}
          className="talisman-gather__particle"
          style={{
            '--talisman-x': particle.x,
            '--talisman-y': particle.y,
            '--talisman-size': `${particle.size}px`,
            '--talisman-delay': particle.delay,
          } as CSSProperties}
        >
          {index % 3 === 0 ? '✦' : ''}
        </span>
      ))}
      <span className="talisman-flare" />
    </span>
  );
}

function TalismanSealEffect({ glyph }: { glyph: string }) {
  return (
    <span
      aria-hidden="true"
      className="talisman-seal-effect"
      data-testid="talisman-seal-effect"
    >
      <span className="talisman-seal-effect__ring" />
      <span className="talisman-seal-effect__glyph">{glyph}</span>
      {SEAL_PARTICLES.map((particle, index) => (
        <span
          key={`${particle.x}:${particle.y}`}
          className="talisman-seal-effect__spark"
          style={{
            '--seal-x': particle.x,
            '--seal-y': particle.y,
            '--seal-size': `${particle.size}px`,
            '--seal-delay': particle.delay,
          } as CSSProperties}
        >
          {index % 2 === 0 ? '✦' : ''}
        </span>
      ))}
    </span>
  );
}

function readStoredStatus(storageKey: string, talismanId: string): DailyTalismanStatus | null {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DailyTalismanStatus>;
    if (parsed.talismanId !== talismanId || typeof parsed.completedAt !== 'string') return null;
    if (typeof parsed.date !== 'string') return null;
    return { date: parsed.date, talismanId: parsed.talismanId, completedAt: parsed.completedAt };
  } catch {
    return null;
  }
}

function writeStoredStatus(storageKey: string, status: DailyTalismanStatus) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(status));
  } catch {
    // localStorage 실패는 리추얼 완료 UI를 막지 않는다.
  }
}

function readDailyStreak(): DailyTalismanStreak | null {
  try {
    const raw = window.localStorage.getItem(DAILY_TALISMAN_STREAK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DailyTalismanStreak>;
    if (typeof parsed.count !== 'number' || typeof parsed.lastDate !== 'string') return null;
    return { count: parsed.count, lastDate: parsed.lastDate };
  } catch {
    return null;
  }
}

function writeDailyStreak(streak: DailyTalismanStreak) {
  try {
    window.localStorage.setItem(DAILY_TALISMAN_STREAK_KEY, JSON.stringify(streak));
  } catch {
    // streak 저장 실패는 봉인 완료 UI를 막지 않는다.
  }
}

function clampProgress(markCount: number): number {
  return Math.min(1, markCount / MIN_DRAW_MARKS);
}

export function DailyTalismanRitual({ chart, todayDate }: DailyTalismanRitualProps) {
  const talisman = useMemo(() => buildDailyTalisman(chart, todayDate), [chart, todayDate]);
  const storageKey = useMemo(() => dailyTalismanStorageKey(chart, todayDate), [chart, todayDate]);
  const talismanId = talisman?.id ?? '';

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  // P1: 진행 카운트는 ref 로 누적하고 진행률 state 는 rAF 로 코얼레스(매 pointermove 리렌더 방지).
  const marksRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const glyphToastTimerRef = useRef<number | null>(null);
  const gatherEffectTimerRef = useRef<number | null>(null);
  const sealEffectTimerRef = useRef<number | null>(null);
  const keyCursorRef = useRef(0);
  const viewedRef = useRef<string | null>(null);

  const [started, setStarted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<DailyTalismanStatus | null>(null);
  const [streak, setStreak] = useState<DailyTalismanStreak | null>(null);
  const [showGlyphToast, setShowGlyphToast] = useState(false);
  const [showGatherEffect, setShowGatherEffect] = useState(false);
  const [showSealEffect, setShowSealEffect] = useState(false);
  const completed = status !== null;

  function cancelRaf() {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }

  function clearGlyphToastTimer() {
    if (glyphToastTimerRef.current != null) {
      window.clearTimeout(glyphToastTimerRef.current);
      glyphToastTimerRef.current = null;
    }
  }

  function clearGatherEffectTimer() {
    if (gatherEffectTimerRef.current != null) {
      window.clearTimeout(gatherEffectTimerRef.current);
      gatherEffectTimerRef.current = null;
    }
  }

  function clearSealEffectTimer() {
    if (sealEffectTimerRef.current != null) {
      window.clearTimeout(sealEffectTimerRef.current);
      sealEffectTimerRef.current = null;
    }
  }

  // 마크 가산. 완료 임계는 즉시 반영(봉인 활성), 중간 진행률만 rAF 로 스로틀.
  function bumpMarks(amount = 1) {
    marksRef.current += amount;
    if (marksRef.current >= MIN_DRAW_MARKS) {
      cancelRaf();
      setProgress(1);
      return;
    }
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      setProgress(clampProgress(marksRef.current));
    });
  }

  // 부적(날짜/요소)이 바뀌면 상태 초기화 + 완료 복원 + 노출 계측 1회.
  useEffect(() => {
    cancelRaf();
    marksRef.current = 0;
    keyCursorRef.current = 0;
    setProgress(0);
    setStarted(false);
    setShowGlyphToast(false);
    setShowGatherEffect(false);
    setShowSealEffect(false);
    clearGlyphToastTimer();
    clearGatherEffectTimer();
    clearSealEffectTimer();
    drawingRef.current = false;

    const restored = talisman ? readStoredStatus(storageKey, talisman.id) : null;
    setStatus(restored);
    setStreak(readDailyStreak());

    if (talisman && !restored && viewedRef.current !== talisman.id) {
      viewedRef.current = talisman.id;
      trackTalismanEvent('talisman_view', { element: talisman.element, theme: talisman.theme });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, talismanId]);

  // 언마운트 시 보류 rAF 정리.
  useEffect(() => () => {
    cancelRaf();
    clearGlyphToastTimer();
    clearGatherEffectTimer();
    clearSealEffectTimer();
  }, []);

  // 그리기 진입 시 캔버스 크기/컨텍스트 설정(DPR 보정).
  useEffect(() => {
    if (!started || completed) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width || 280));
    const height = Math.max(1, Math.round(rect.height || 168));
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.clearRect(0, 0, width, height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(255,255,255,0.88)';
  }, [completed, started]);

  if (!talisman) return null;
  const t = talisman; // 이하 클로저에서도 non-null 보장.

  function pointFromEvent(event: PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function drawPoint(event: PointerEvent<HTMLCanvasElement>, begin = false) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const point = pointFromEvent(event);
    if (!ctx) {
      bumpMarks();
      return;
    }

    if (begin) {
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
    } else {
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }
    bumpMarks();
  }

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = true;
    drawPoint(event, true);
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawPoint(event);
  }

  function handlePointerEnd() {
    drawingRef.current = false;
  }

  // A1: 포인터 없이(키보드/AT) 부적을 채울 수 있는 경로. Enter/Space/방향키로 마크 가산.
  function handleCanvasKeyDown(event: KeyboardEvent<HTMLCanvasElement>) {
    if (completed) return;
    const { key } = event;
    if (key !== 'Enter' && key !== ' ' && key !== 'Spacebar' && !key.startsWith('Arrow')) return;
    event.preventDefault();

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width || 280;
      const height = rect.height || 168;
      const step = keyCursorRef.current;
      keyCursorRef.current += 1;
      const x = ((step * 26) % Math.max(40, width - 24)) + 12;
      // 부드러운 좌→우 획(느린 사인파) — 키보드 경로 시각을 '따라쓰기'에 가깝게.
      const y = height / 2 + Math.sin(step * 0.5) * 18;
      if (step === 0) {
        ctx.beginPath();
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    }
    bumpMarks(KEY_MARK_STEP);
  }

  function handleStartClick() {
    trackTalismanEvent('talisman_start', { element: t.element, theme: t.theme });
    clearGatherEffectTimer();
    setShowGatherEffect(true);
    gatherEffectTimerRef.current = window.setTimeout(() => {
      setShowGatherEffect(false);
      gatherEffectTimerRef.current = null;
    }, GATHER_EFFECT_MS);
    setStarted(true);
  }

  function handleGlyphPreviewClick() {
    clearGlyphToastTimer();
    setShowGlyphToast(true);
    glyphToastTimerRef.current = window.setTimeout(() => {
      setShowGlyphToast(false);
      glyphToastTimerRef.current = null;
    }, GLYPH_TOAST_MS);
  }

  function completeRitual() {
    const nextStatus = {
      date: todayDate,
      talismanId: t.id,
      completedAt: new Date().toISOString(),
    };
    writeStoredStatus(storageKey, nextStatus);
    const nextStreak = advanceStreak(readDailyStreak(), todayDate);
    writeDailyStreak(nextStreak);
    trackTalismanEvent('talisman_complete', { element: t.element, theme: t.theme });
    clearSealEffectTimer();
    setShowSealEffect(true);
    sealEffectTimerRef.current = window.setTimeout(() => {
      setShowSealEffect(false);
      sealEffectTimerRef.current = null;
    }, SEAL_EFFECT_MS);
    setStatus(nextStatus);
    setStreak(nextStreak);
    setStarted(false);
  }

  // 오늘 봉인 후 2일 이상 연속이면 배지 노출(끊긴/첫날 streak 는 숨김).
  const streakCount =
    streak && streak.lastDate === todayDate && streak.count >= 2 ? streak.count : null;

  if (completed) {
    return (
      <section
        aria-label="오늘의 액땜 부적 완료"
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderRadius: 'var(--r-md)',
          background: 'rgba(255,255,255,0.16)',
          border: '1px solid rgba(255,255,255,0.22)',
          padding: 12,
          overflow: 'hidden',
        }}
      >
        {showSealEffect && <TalismanSealEffect glyph={t.glyph} />}
        <span
          aria-hidden
          style={{
            width: 44,
            height: 44,
            borderRadius: 16,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(255,255,255,0.22)',
            boxShadow: '0 0 24px rgba(255,255,255,0.18)',
            flexShrink: 0,
          }}
        >
          <ShieldCheck size={22} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'white' }}>
              {t.guardLabel}
            </span>
            {streakCount !== null && (
              <span
                aria-label={`${streakCount}일 연속 봉인`}
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: 'white',
                  background: 'rgba(255,255,255,0.22)',
                  borderRadius: 999,
                  padding: '1px 8px',
                  whiteSpace: 'nowrap',
                }}
              >
                🔥 {streakCount}일 연속
              </span>
            )}
          </span>
          <span style={{ display: 'block', marginTop: 3, fontSize: 12, fontWeight: 600, lineHeight: 1.45, color: 'rgba(255,255,255,0.82)' }}>
            {t.actionText}
          </span>
        </span>
        <span
          aria-label={`${t.glyph} ${t.meaning}`}
          style={{
            width: 40,
            height: 40,
            borderRadius: 14,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(255,255,255,0.92)',
            color: 'var(--p-30)',
            fontSize: 24,
            fontWeight: 900,
            fontFamily: 'serif',
            flexShrink: 0,
          }}
        >
          {t.glyph}
        </span>
      </section>
    );
  }

  if (!started) {
    return (
      <section
        aria-label="오늘의 액땜 부적"
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          borderRadius: 'var(--r-md)',
          background: 'rgba(255,255,255,0.14)',
          border: '1px solid rgba(255,255,255,0.18)',
          padding: 14,
        }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span
            aria-hidden
            style={{
              width: 40,
              height: 40,
              borderRadius: 14,
              display: 'grid',
              placeItems: 'center',
              background: 'rgba(255,255,255,0.2)',
              flexShrink: 0,
            }}
          >
            <Sparkles size={20} />
          </span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.75)' }}>
              오늘 채우면 좋은 기운 · {t.element}
            </span>
            <span style={{ display: 'block', marginTop: 3, fontSize: 13, fontWeight: 750, color: 'white', lineHeight: 1.4 }}>
              {t.gapLabel}
            </span>
          </span>
        </div>
        <button
          type="button"
          className="btn-cta"
          onClick={handleStartClick}
          style={{
            minHeight: 44,
            border: '1px solid rgba(255,255,255,0.28)',
            borderRadius: 'var(--r-pill)',
            background: 'rgba(255,255,255,0.92)',
            color: 'var(--p-20)',
            fontSize: 14,
            fontWeight: 850,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            cursor: 'pointer',
          }}
        >
          <PenLine size={17} />
          액땜 부적 받기
        </button>
      </section>
    );
  }

  return (
    <section
      aria-label="액땜 부적 따라쓰기"
      style={{
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        borderRadius: 'var(--r-md)',
        background: 'rgba(255,255,255,0.16)',
        border: '1px solid rgba(255,255,255,0.22)',
        padding: 14,
      }}
    >
      {showGatherEffect && <TalismanGatherEffect />}
      {showGlyphToast && (
        <div
          className="talisman-toast"
          role="status"
          aria-live="polite"
          data-testid="talisman-glyph-toast"
        >
          <span className="talisman-toast__glyph" aria-hidden="true">
            {t.glyph}
          </span>
          <span className="talisman-toast__body">
            <span className="talisman-toast__title">{t.glyph} · {t.meaning}</span>
            <span className="talisman-toast__meta">{t.strokeCount}획이라 손가락으로 따라쓰기 쉬워요</span>
          </span>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.78)' }}>
            오늘의 부적 글자
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 850, color: 'white' }}>
            {t.glyph} · {t.meaning}
          </p>
        </div>
        <button
          type="button"
          aria-label={`부적 글자 ${t.glyph} 크게 보기`}
          onClick={handleGlyphPreviewClick}
          style={{
            width: 54,
            height: 54,
            border: 'none',
            borderRadius: 18,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(255,255,255,0.92)',
            color: 'var(--p-30)',
            fontFamily: 'serif',
            fontSize: 34,
            fontWeight: 900,
            boxShadow: '0 10px 26px rgba(38,20,86,0.16)',
            flexShrink: 0,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          {t.glyph}
        </button>
      </div>

      <div
        style={{
          position: 'relative',
          borderRadius: 18,
          overflow: 'hidden',
          background: 'rgba(255,255,255,0.12)',
          border: '1px dashed rgba(255,255,255,0.34)',
          minHeight: 160,
        }}
      >
        <span
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            color: 'rgba(255,255,255,0.13)',
            fontFamily: 'serif',
            fontSize: 112,
            fontWeight: 900,
            pointerEvents: 'none',
          }}
        >
          {t.glyph}
        </span>
        <canvas
          ref={canvasRef}
          aria-label={`${t.glyph} ${t.meaning} 따라쓰기 영역`}
          aria-roledescription="부적 따라쓰기"
          role="slider"
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          aria-valuetext={`${Math.round(progress * 100)}% 채움 — 방향키 또는 스페이스로 채우기`}
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onPointerLeave={handlePointerEnd}
          onKeyDown={handleCanvasKeyDown}
          style={{
            position: 'relative',
            display: 'block',
            width: '100%',
            height: 168,
            touchAction: 'none',
            cursor: 'crosshair',
            outlineOffset: 2,
          }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          aria-label={`따라쓰기 진행률 ${Math.round(progress * 100)}퍼센트`}
          style={{
            flex: 1,
            height: 8,
            borderRadius: 999,
            background: 'rgba(255,255,255,0.18)',
            overflow: 'hidden',
          }}
        >
          <span
            style={{
              display: 'block',
              width: `${Math.round(progress * 100)}%`,
              height: '100%',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.86)',
              transition: 'width 0.16s ease',
            }}
          />
        </div>
        <button
          type="button"
          disabled={progress < 1}
          onClick={completeRitual}
          style={{
            minHeight: 40,
            border: 'none',
            borderRadius: 'var(--r-pill)',
            background: progress >= 1 ? 'rgba(255,255,255,0.94)' : 'rgba(255,255,255,0.24)',
            color: progress >= 1 ? 'var(--p-20)' : 'rgba(255,255,255,0.72)',
            padding: '0 14px',
            fontSize: 13,
            fontWeight: 850,
            cursor: progress >= 1 ? 'pointer' : 'not-allowed',
            flexShrink: 0,
          }}
        >
          봉인하기
        </button>
      </div>
    </section>
  );
}
