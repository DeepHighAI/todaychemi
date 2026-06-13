import type { OgPayload, ShareAreaScores } from '@/lib/og/render-payload';

const OHAENG_ORDER = ['목', '화', '토', '금', '수'] as const;

// 색 토큰 (warm) — 인앱 프리뷰가 본 이미지(authed OG)를 그대로 쓰므로 단일 진실.
const C_BG_FROM = '#FFF7ED';
const C_BG_TO = '#FFEDD5';
const C_TITLE = '#92400E';
const C_SCORE = '#7C2D12';
const C_ACCENT = '#A16207';
const C_LINE = '#D97706';

// radar 축 (content.area_scores 순서 고정)
const RADAR_AXES: Array<{ key: keyof ShareAreaScores; label: string }> = [
  { key: 'talk', label: '대화' },
  { key: 'attract', label: '끌림' },
  { key: 'speed', label: '속도' },
  { key: 'money', label: '금전' },
  { key: 'future', label: '미래' },
];

const RADAR_CX = 130;
const RADAR_CY = 130;
const RADAR_R = 92;

function clamp01(value: number): number {
  return Math.min(100, Math.max(0, value)) / 100;
}

function radarPoint(index: number, ratio: number): [number, number] {
  const angle = ((-90 + index * 72) * Math.PI) / 180;
  return [RADAR_CX + RADAR_R * ratio * Math.cos(angle), RADAR_CY + RADAR_R * ratio * Math.sin(angle)];
}

function RadarChart({ scores }: { scores: ShareAreaScores }) {
  const guide = RADAR_AXES.map((_, i) => radarPoint(i, 1)).map(([x, y]) => `${x},${y}`).join(' ');
  const data = RADAR_AXES.map((axis, i) => radarPoint(i, clamp01(scores[axis.key] ?? 0)))
    .map(([x, y]) => `${x},${y}`)
    .join(' ');
  return (
    <svg data-testid="og-radar" width="260" height="260" viewBox="0 0 260 260">
      <polygon points={guide} fill="none" stroke={C_LINE} strokeOpacity="0.35" strokeWidth="2" />
      <polygon points={data} fill={C_SCORE} fillOpacity="0.28" stroke={C_SCORE} strokeWidth="3" />
      {RADAR_AXES.map((axis, i) => {
        const [lx, ly] = radarPoint(i, 1.18);
        return (
          <text key={axis.key} x={lx} y={ly} fill={C_TITLE} fontSize="20" textAnchor="middle">
            {axis.label}
          </text>
        );
      })}
    </svg>
  );
}

function FlowChart({ scores }: { scores: number[] }) {
  const W = 280;
  const H = 96;
  const PAD = 12;
  const n = scores.length;
  const points = scores
    .map((s, i) => {
      const x = PAD + (W - 2 * PAD) * (n <= 1 ? 0 : i / (n - 1));
      const y = H - PAD - (H - 2 * PAD) * clamp01(s);
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg data-testid="og-flow" width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <polyline points={points} fill="none" stroke={C_SCORE} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function LayoutContent({ payload }: { payload: OgPayload }) {
  if (payload.layout === 'ohaeng' && payload.ohaeng_counts) {
    return (
      <div style={{ display: 'flex', fontSize: 28, color: C_TITLE, gap: 16 }}>
        {OHAENG_ORDER.map((k) => (
          <span key={k}>
            {k} {payload.ohaeng_counts?.[k] ?? 0}
          </span>
        ))}
      </div>
    );
  }
  if (payload.layout === 'radar' && payload.area_scores) {
    return (
      <div style={{ display: 'flex' }}>
        <RadarChart scores={payload.area_scores} />
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
        “{payload.headline}”
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
        {payload.nickname}님과의 {payload.mode}
      </div>
      <div style={{ fontSize: 96, fontWeight: 800, color: C_SCORE, marginBottom: 24 }}>
        케미온도 {payload.temperature_label}
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
