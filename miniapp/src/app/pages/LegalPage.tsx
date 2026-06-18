/**
 * LegalPage.tsx — 인앱 법적 문서 뷰어 (약관/개인정보처리방침/환불정책)
 *
 * 앱인토스 미니앱(유료 IAP) 검수 요건: 정책 문서를 인앱에서 열람 가능해야 함.
 * 웹앱 `/api/legal/documents/:slug` 를 단일 출처로 재사용(버전 항상 최신).
 *
 * - slug: 'terms' | 'privacy' | 'refund' (라우트 파라미터)
 * - 본문 fetch·마크다운 렌더는 공용 LegalDocContent 사용(LegalDocSheet 와 공유).
 *
 * 출처: 구현 레퍼런스 §6(검수/정책), 웹 src/app/legal/_components/legal-document-page.tsx.
 */

import { useParams, useNavigate } from 'react-router-dom';

import { LegalDocContent, isLegalSlug } from '@/components/legal/legal-markdown';

export function LegalPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const isValid = isLegalSlug(slug);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)' }}>
      {/* 헤더 */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '8px 12px',
          backgroundColor: 'var(--bg-base)',
          borderBottom: '1px solid var(--hairline)',
        }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="back"
          style={{
            width: 32,
            height: 32,
            border: 'none',
            background: 'none',
            fontSize: 22,
            color: 'var(--text-primary)',
            cursor: 'pointer',
          }}
        >
          ‹
        </button>
      </header>

      <main style={{ padding: '16px 20px 64px' }}>
        {!isValid ? (
          <p style={{ font: 'var(--t-sub)', color: 'var(--warn)', textAlign: 'center', padding: '32px 0' }}>
            문서를 찾을 수 없어요.
          </p>
        ) : (
          <LegalDocContent slug={slug} />
        )}
      </main>
    </div>
  );
}
