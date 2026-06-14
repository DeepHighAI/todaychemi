import {
  formatTemperatureDeltaBetweenScores,
  scoreToTemperature,
} from '@/lib/scoring/temperature';
import {
  SHARE_OHAENG_ORDER,
  type OgPayload,
  type RadarOverlay,
  type ShareAreaScores,
} from '@/lib/og/render-payload';

const OHAENG_ORDER = SHARE_OHAENG_ORDER;
const AREA_ORDER = [
  ['talk', '대화'],
  ['attract', '끌림'],
  ['speed', '속도'],
  ['money', '금전'],
  ['future', '미래'],
] as const;

// 색 토큰 (warm) — 인앱 프리뷰가 본 이미지(authed OG)를 그대로 쓰므로 단일 진실.
const C_BG_FROM = '#FFF7ED';
const C_BG_TO = '#FFEDD5';
const C_TITLE = '#7C2D12';
const C_SCORE = '#6B2418';
const C_ACCENT = '#9A4F12';
const C_PANEL = '#FFFDF7';
const C_PANEL_SOFT = '#E3C88F';
const C_TRACK = '#EAD9AC';
const C_TRACK_SOFT = '#F6E9C8';
const C_MUTED = '#754117';
// 솔리드 색만 사용 (Satori 는 SVG fill-opacity/stroke-opacity 미지원 가능 — 투명도 대신 옅은 솔리드).
const C_RADAR_GUIDE = '#EBCBA3';
const C_RADAR_USER = '#7C2D12';   // 나
const C_RADAR_REL = '#D97706';    // 인연
const OHAENG_COLORS: Record<(typeof OHAENG_ORDER)[number], string> = {
  목: '#217A50',
  화: '#B42318',
  토: '#9A4F12',
  금: '#6A5A45',
  수: '#1F5F8B',
};

const RADAR_CX = 120;
const RADAR_CY = 120;
const RADAR_R = 95;

function ohaengRatio(counts: Record<string, number>, key: string, denom: number): number {
  return Math.max(0, counts[key] ?? 0) / denom;
}

function radarPoint(index: number, ratio: number): [number, number] {
  const angle = ((-90 + index * 72) * Math.PI) / 180;
  return [RADAR_CX + RADAR_R * ratio * Math.cos(angle), RADAR_CY + RADAR_R * ratio * Math.sin(angle)];
}

function radarPolygon(counts: Record<string, number>, denom: number): string {
  return OHAENG_ORDER.map((k, i) => radarPoint(i, Math.min(1, ohaengRatio(counts, k, denom))))
    .map(([x, y]) => `${x},${y}`)
    .join(' ');
}

// 나 vs 인연 오행(목화토금수) 오버레이 (§1.1). Satori 는 SVG <text> 불확실 → 축 라벨은 DIV 범례.
function RadarChart({ radar }: { radar: RadarOverlay }) {
  const denom = Math.max(
    1,
    ...OHAENG_ORDER.map((k) => Math.max(radar.user[k] ?? 0, radar.relation[k] ?? 0)),
  );
  const guide = OHAENG_ORDER.map((_, i) => radarPoint(i, 1)).map(([x, y]) => `${x},${y}`).join(' ');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <svg data-testid="og-radar" width="240" height="240" viewBox="0 0 240 240">
        <polygon points={guide} fill="none" stroke={C_RADAR_GUIDE} strokeWidth="2" />
        <polygon points={radarPolygon(radar.relation, denom)} fill="none" stroke={C_RADAR_REL} strokeWidth="3" />
        <polygon points={radarPolygon(radar.user, denom)} fill="none" stroke={C_RADAR_USER} strokeWidth="3" />
      </svg>
      <div style={{ display: 'flex', gap: 12, fontSize: 18, color: C_TITLE }}>
        {OHAENG_ORDER.map((k) => (
          <span key={k}>{k}</span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 16, fontSize: 16 }}>
        <span style={{ color: C_RADAR_USER }}>{'— 나'}</span>
        <span style={{ color: C_RADAR_REL }}>{'— 인연'}</span>
      </div>
    </div>
  );
}

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
}

function flowDomain(scores: number[]): { min: number; max: number } {
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const minSpan = 6;
  if (max - min >= minSpan) {
    return { min: Math.max(0, min - 1), max: Math.min(100, max + 1) };
  }
  const center = (min + max) / 2;
  const half = minSpan / 2;
  const low = Math.max(0, center - half);
  const high = Math.min(100, center + half);
  if (high - low >= minSpan) return { min: low, max: high };
  if (low === 0) return { min: 0, max: minSpan };
  return { min: 100 - minSpan, max: 100 };
}

function signedDeltaLabel(scores: number[]): string {
  if (scores.length < 2) return '첫 기록';
  return `직전 ${formatTemperatureDeltaBetweenScores(scores[scores.length - 2], scores[scores.length - 1])}`;
}

function truncateOgText(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

function FlowChart({ scores, compact = false }: { scores: number[]; compact?: boolean }) {
  const W = compact ? 860 : 420;
  const H = compact ? 126 : 88;
  const PAD_X = compact ? 22 : 16;
  const PAD_Y = compact ? 16 : 12;
  const safeScores = scores.filter(Number.isFinite).map(clampScore);
  const n = safeScores.length;
  const latest = safeScores[n - 1] ?? 50;
  const first = safeScores[0] ?? latest;
  const domain = n > 0 ? flowDomain(safeScores) : { min: 0, max: 100 };
  const domainSpan = Math.max(1, domain.max - domain.min);
  const coords = safeScores.map((s, i): [number, number] => {
    const x = PAD_X + (W - 2 * PAD_X) * (n <= 1 ? 0.5 : i / (n - 1));
    const y = H - PAD_Y - (H - 2 * PAD_Y) * ((s - domain.min) / domainSpan);
    return [x, y];
  });
  return (
    <div data-testid="og-flow-card" style={{ display: 'flex', flexDirection: 'column', gap: compact ? 8 : 6, width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: compact ? 28 : 24, fontWeight: 900, color: C_SCORE }}>
          {`최근 ${scoreToTemperature(latest).toFixed(1)}°C`}
        </span>
        <span style={{ fontSize: compact ? 24 : 21, fontWeight: 900, color: C_ACCENT }}>
          {signedDeltaLabel(safeScores)}
        </span>
      </div>
      <svg data-testid="og-flow" width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <line x1={PAD_X} x2={W - PAD_X} y1={PAD_Y} y2={PAD_Y} stroke={C_TRACK_SOFT} strokeWidth="3" />
        <line x1={PAD_X} x2={W - PAD_X} y1={H / 2} y2={H / 2} stroke={C_TRACK_SOFT} strokeWidth="3" />
        <line
          x1={PAD_X}
          x2={W - PAD_X}
          y1={H - PAD_Y}
          y2={H - PAD_Y}
          stroke={C_TRACK}
          strokeWidth="3"
        />
        {n >= 2 ? (
          <g>
            <polyline
              points={coords.map(([x, y]) => `${x},${y}`).join(' ')}
              fill="none"
              stroke={C_SCORE}
              strokeWidth="7"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {coords.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="6" fill={i === n - 1 ? C_SCORE : C_ACCENT} />
            ))}
          </g>
        ) : (
          // 해석 1건이면 선이 안 보이므로 단일 점 마커 (ISSUE-003)
          <circle cx={coords[0]?.[0] ?? W / 2} cy={coords[0]?.[1] ?? H / 2} r="8" fill={C_SCORE} />
        )}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: compact ? 20 : 18, fontWeight: 800, color: C_MUTED }}>
        <span>{`이전 ${scoreToTemperature(first).toFixed(1)}°`}</span>
        <span>{`최신 ${scoreToTemperature(latest).toFixed(1)}°`}</span>
      </div>
    </div>
  );
}

function normalizeScore(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Number(value)));
}

function OhaengStrip({ counts }: { counts?: Record<string, number> }) {
  const values = OHAENG_ORDER.map((k) => Math.max(0, Math.round(counts?.[k] ?? 0)));
  const total = values.reduce((sum, value) => sum + value, 0);
  return (
    <div
      data-testid="og-ohaeng-strip"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        width: '100%',
        padding: '24px 26px',
        borderRadius: 28,
        background: C_PANEL,
        border: `2px solid ${C_PANEL_SOFT}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', fontSize: 29, fontWeight: 900, color: C_TITLE }}>
        오행
      </div>
      {OHAENG_ORDER.map((k) => {
        const index = OHAENG_ORDER.indexOf(k);
        const count = values[index] ?? 0;
        const percent = total > 0 ? Math.round((count / total) * 100) : 0;
        const fillWidth = total > 0 && count > 0 ? Math.max(10, percent) : 0;
        return (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', width: 42, fontSize: 24, fontWeight: 900, color: OHAENG_COLORS[k] }}>
              {k}
            </div>
            <div style={{ display: 'flex', flex: 1, height: 18, borderRadius: 99, background: C_TRACK_SOFT }}>
              <div
                style={{
                  display: 'flex',
                  width: `${fillWidth}%`,
                  height: 18,
                  borderRadius: 99,
                  background: OHAENG_COLORS[k],
                }}
              />
            </div>
            <div style={{ display: 'flex', width: 64, justifyContent: 'flex-end', fontSize: 22, fontWeight: 900, color: C_MUTED }}>
              {`${count}개`}
            </div>
            <div style={{ display: 'flex', width: 58, justifyContent: 'flex-end', fontSize: 22, fontWeight: 900, color: C_MUTED }}>
              {`${percent}%`}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AreaBars({ scores }: { scores?: ShareAreaScores }) {
  return (
    <div
      data-testid="og-area-bars"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        padding: '24px 26px',
        borderRadius: 28,
        background: C_PANEL,
        border: `2px solid ${C_PANEL_SOFT}`,
      }}
    >
      <div style={{ display: 'flex', fontSize: 29, fontWeight: 900, color: C_TITLE }}>영역</div>
      {AREA_ORDER.map(([key, label]) => {
        const rawScore = scores?.[key];
        const score = rawScore === undefined ? null : normalizeScore(rawScore);
        return (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{ display: 'flex', width: 72, fontSize: 24, fontWeight: 900, color: C_MUTED }}>
              {label}
            </div>
            <div style={{ display: 'flex', flex: 1, height: 18, borderRadius: 99, background: C_TRACK_SOFT }}>
              <div
                style={{
                  display: 'flex',
                  width: `${score === null ? 10 : Math.max(10, score)}%`,
                  height: 18,
                  borderRadius: 99,
                  background: score === null ? C_TRACK : score >= 70 ? C_SCORE : C_ACCENT,
                }}
              />
            </div>
            <div
              style={{
                display: 'flex',
                width: 82,
                justifyContent: 'flex-end',
                fontSize: 24,
                fontWeight: 900,
                color: C_SCORE,
              }}
            >
              {score === null ? '—' : `${scoreToTemperature(score).toFixed(1)}°`}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CombinedContent({ payload }: { payload: OgPayload }) {
  return (
    <div data-testid="og-combined-content" style={{ display: 'flex', flexDirection: 'column', gap: 18, width: '100%' }}>
      <OhaengStrip counts={payload.ohaeng_counts} />
      <AreaBars scores={payload.area_scores} />
      <div
        data-testid="og-combined-headline"
        style={{
          display: 'flex',
          minHeight: 142,
          alignItems: 'center',
          padding: '26px 30px',
          borderRadius: 28,
          background: C_PANEL,
          border: `2px solid ${C_PANEL_SOFT}`,
          fontSize: 33,
          lineHeight: 1.32,
          fontWeight: 900,
          color: C_TITLE,
        }}
      >
        {`“${payload.headline || '오늘 케미를 확인해봐'}”`}
      </div>
    </div>
  );
}

function LayoutContent({ payload }: { payload: OgPayload }) {
  if (payload.layout === 'combined') {
    return <CombinedContent payload={payload} />;
  }
  if (payload.layout === 'ohaeng' && payload.ohaeng_counts) {
    return (
      <div style={{ display: 'flex', fontSize: 28, color: C_TITLE, gap: 16 }}>
        {OHAENG_ORDER.map((k) => (
          <span key={k}>{`${k} ${payload.ohaeng_counts?.[k] ?? 0}`}</span>
        ))}
      </div>
    );
  }
  if (payload.layout === 'radar' && payload.radar) {
    return (
      <div style={{ display: 'flex' }}>
        <RadarChart radar={payload.radar} />
      </div>
    );
  }
  if (payload.layout === 'comment' && payload.headline) {
    return (
      <div
        style={{
          display: 'flex',
          fontSize: 34,
          color: C_TITLE,
          fontWeight: 700,
          textAlign: 'center',
          maxWidth: 760,
        }}
      >
        {`“${payload.headline}”`}
      </div>
    );
  }
  if (payload.layout === 'flow' && payload.flow_scores) {
    return (
      <div style={{ display: 'flex' }}>
        <FlowChart scores={payload.flow_scores} />
      </div>
    );
  }
  return null;
}

export function OgTemplate({ payload }: { payload: OgPayload }) {
  const isCombined = payload.layout === 'combined';
  const relationshipLabel = `${payload.nickname}님과의 ${payload.mode}`;
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: isCombined ? 'flex-start' : 'center',
        background: `linear-gradient(135deg, ${C_BG_FROM} 0%, ${C_BG_TO} 100%)`,
        padding: isCombined ? '58px 70px 44px' : '60px',
        fontFamily: 'Noto Sans KR',
      }}
    >
      <div
        style={{
          display: 'flex',
          height: isCombined ? 42 : undefined,
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          fontSize: isCombined ? 30 : 32,
          lineHeight: 1.2,
          fontWeight: 800,
          color: C_TITLE,
          marginBottom: isCombined ? 10 : 16,
          overflow: 'hidden',
        }}
      >
        {isCombined ? truncateOgText(relationshipLabel, 24) : relationshipLabel}
      </div>
      <div
        style={{
          display: 'flex',
          height: isCombined ? 98 : undefined,
          alignItems: 'center',
          fontSize: isCombined ? 82 : 96,
          lineHeight: isCombined ? 0.98 : 1,
          fontWeight: 900,
          color: C_SCORE,
          marginBottom: isCombined ? 34 : 24,
        }}
      >
        {`케미온도 ${payload.temperature_label}`}
      </div>

      <LayoutContent payload={payload} />

      {payload.showGender && payload.gender_normalized && (
        <div style={{ fontSize: 28, color: C_TITLE, marginTop: 16 }}>
          {payload.gender_normalized === 'F' ? '여성' : '남성'}
        </div>
      )}

      <div style={{ marginTop: 'auto', fontSize: isCombined ? 25 : 24, fontWeight: 800, color: C_ACCENT, letterSpacing: 0 }}>
        오늘케미에서 확인해봐
      </div>
    </div>
  );
}
