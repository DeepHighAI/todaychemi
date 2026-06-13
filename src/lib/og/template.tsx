import type { OgPayload, RadarOverlay } from '@/lib/og/render-payload';

const OHAENG_ORDER = ['목', '화', '토', '금', '수'] as const;

// 색 토큰 (warm) — 인앱 프리뷰가 본 이미지(authed OG)를 그대로 쓰므로 단일 진실.
const C_BG_FROM = '#FFF7ED';
const C_BG_TO = '#FFEDD5';
const C_TITLE = '#92400E';
const C_SCORE = '#7C2D12';
const C_ACCENT = '#A16207';
// 솔리드 색만 사용 (Satori 는 SVG fill-opacity/stroke-opacity 미지원 가능 — 투명도 대신 옅은 솔리드).
const C_RADAR_GUIDE = '#EBCBA3';
const C_RADAR_USER = '#7C2D12';   // 나
const C_RADAR_REL = '#D97706';    // 인연

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

function clamp01(value: number): number {
  return Math.min(100, Math.max(0, value)) / 100;
}

function FlowChart({ scores }: { scores: number[] }) {
  const W = 280;
  const H = 96;
  const PAD = 12;
  const n = scores.length;
  const coords = scores.map((s, i): [number, number] => {
    const x = PAD + (W - 2 * PAD) * (n <= 1 ? 0.5 : i / (n - 1));
    const y = H - PAD - (H - 2 * PAD) * clamp01(s);
    return [x, y];
  });
  return (
    <svg data-testid="og-flow" width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {n >= 2 ? (
        <polyline
          points={coords.map(([x, y]) => `${x},${y}`).join(' ')}
          fill="none"
          stroke={C_SCORE}
          strokeWidth="4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ) : (
        // 해석 1건이면 선이 안 보이므로 단일 점 마커 (ISSUE-003)
        <circle cx={coords[0]?.[0] ?? W / 2} cy={coords[0]?.[1] ?? H / 2} r="6" fill={C_SCORE} />
      )}
    </svg>
  );
}

function LayoutContent({ payload }: { payload: OgPayload }) {
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
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: `linear-gradient(135deg, ${C_BG_FROM} 0%, ${C_BG_TO} 100%)`,
        padding: '60px',
        fontFamily: 'Noto Sans KR',
      }}
    >
      <div style={{ fontSize: 32, color: C_TITLE, marginBottom: 16 }}>
        {`${payload.nickname}님과의 ${payload.mode}`}
      </div>
      <div style={{ fontSize: 96, fontWeight: 800, color: C_SCORE, marginBottom: 24 }}>
        {`케미온도 ${payload.temperature_label}`}
      </div>

      <LayoutContent payload={payload} />

      {payload.showGender && payload.gender_normalized && (
        <div style={{ fontSize: 28, color: C_TITLE, marginTop: 16 }}>
          {payload.gender_normalized === 'F' ? '여성' : '남성'}
        </div>
      )}

      <div style={{ marginTop: 'auto', fontSize: 22, color: C_ACCENT, letterSpacing: 2 }}>
        오늘케미에서 확인해봐
      </div>
    </div>
  );
}
