/**
 * WhatifPage.tsx — 또 다른 나(자기진단 6모드) (stub)
 *
 * TODO(P4): WhatifView + DiagnosticType 라우팅 + 결제 게이트(₩800) 포팅.
 */
import { useParams } from 'react-router-dom';

export function WhatifPage() {
  const { type } = useParams<{ type: string }>();

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ font: 'var(--t-h1)', letterSpacing: 'var(--ls-tight)', margin: 0 }}>
        또 다른 나
      </h1>
      <p style={{ color: 'var(--text-secondary)', font: 'var(--t-body)', marginTop: 8 }}>
        타입: {type}
      </p>
      <p style={{ color: 'var(--outline)', font: 'var(--t-cap)', marginTop: 16 }}>
        [TODO P4] 6모드 진단 UI + 결제 게이트 포팅 예정
      </p>
    </div>
  );
}
