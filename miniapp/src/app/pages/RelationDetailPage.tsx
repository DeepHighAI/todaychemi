/**
 * RelationDetailPage.tsx — 인연 상세 + 타임라인 (stub)
 *
 * TODO(P4): RelationTimeline + 케미카드 목록 UI 포팅.
 */
import { useParams } from 'react-router-dom';

export function RelationDetailPage() {
  const { relationId } = useParams<{ relationId: string }>();

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ font: 'var(--t-h1)', letterSpacing: 'var(--ls-tight)', margin: 0 }}>
        인연 상세
      </h1>
      <p style={{ color: 'var(--text-secondary)', font: 'var(--t-body)', marginTop: 8 }}>
        ID: {relationId}
      </p>
      <p style={{ color: 'var(--outline)', font: 'var(--t-cap)', marginTop: 16 }}>
        [TODO P4] 타임라인 + 케미카드 목록 포팅 예정
      </p>
    </div>
  );
}
