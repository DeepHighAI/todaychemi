import type { OgPayload } from '@/lib/og/render-payload';

const OHAENG_ORDER = ['목', '화', '토', '금', '수'] as const;

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
        background: 'linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)',
        padding: '60px',
        fontFamily: 'Noto Sans KR',
      }}
    >
      <div
        style={{
          fontSize: 32,
          color: '#92400E',
          marginBottom: 16,
        }}
      >
        {payload.nickname}님과의 {payload.mode}
      </div>
      <div
        style={{
          fontSize: 96,
          fontWeight: 800,
          color: '#7C2D12',
          marginBottom: 24,
        }}
      >
        케미온도 {payload.temperature_label}
      </div>

      {payload.range === 'nickname-ohaeng' && payload.ohaeng_counts && (
        <div style={{ display: 'flex', fontSize: 28, color: '#92400E', gap: 16 }}>
          {OHAENG_ORDER.map((k) => (
            <span key={k}>
              {k} {payload.ohaeng_counts?.[k] ?? 0}
            </span>
          ))}
        </div>
      )}

      {payload.range === 'nickname-gender' && payload.gender_normalized && (
        <div style={{ fontSize: 28, color: '#92400E' }}>
          {payload.gender_normalized === 'F' ? '여성' : '남성'}
        </div>
      )}

      <div
        style={{
          marginTop: 'auto',
          fontSize: 22,
          color: '#A16207',
          letterSpacing: 2,
        }}
      >
        오늘케미에서 확인해봐
      </div>
    </div>
  );
}
