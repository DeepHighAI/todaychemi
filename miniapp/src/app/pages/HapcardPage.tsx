/**
 * HapcardPage.tsx — 케미카드 뷰어 (stub)
 *
 * TODO(P4): HapcardView 9섹션 + 결제 게이트(₩1,000) 포팅.
 */
import { useParams } from 'react-router-dom';

export function HapcardPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ font: 'var(--t-h1)', letterSpacing: 'var(--ls-tight)', margin: 0 }}>
        케미카드
      </h1>
      <p style={{ color: 'var(--text-secondary)', font: 'var(--t-body)', marginTop: 8 }}>
        ID: {id}
      </p>
      <p style={{ color: 'var(--outline)', font: 'var(--t-cap)', marginTop: 16 }}>
        [TODO P4] HapcardView + FeaturePaySheet 결제 게이트 포팅 예정
      </p>
    </div>
  );
}
