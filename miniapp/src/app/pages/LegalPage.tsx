/**
 * LegalPage.tsx — 인앱 법적 문서 뷰어 (약관/개인정보처리방침/환불정책)
 *
 * 앱인토스 미니앱(유료 IAP) 검수 요건: 정책 문서를 인앱에서 열람 가능해야 함.
 * 웹앱 `/api/legal/documents/:slug` 를 단일 출처로 재사용(버전 항상 최신).
 *
 * - slug: 'terms' | 'privacy' | 'refund' (라우트 파라미터)
 * - 인증 불필요(공개 GET) — token 없이 apiFetch.
 * - 마크다운은 react-markdown + remark-gfm 로 렌더.
 *
 * 출처: 구현 레퍼런스 §6(검수/정책), 웹 src/app/legal/_components/legal-document-page.tsx.
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { apiFetch } from '@/lib/api/client';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorCard } from '@/components/feedback/ErrorCard';

// ---------------------------------------------------------------------------
// 타입
// ---------------------------------------------------------------------------

type LegalSlug = 'terms' | 'privacy' | 'refund';

interface LegalDocument {
  slug: LegalSlug;
  title: string;
  version: string;
  markdown: string;
}

const VALID_SLUGS: ReadonlySet<string> = new Set(['terms', 'privacy', 'refund']);

// ---------------------------------------------------------------------------
// 마크다운 렌더 매핑 (인라인 스타일 — 미니앱 토큰)
// ---------------------------------------------------------------------------

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 style={{ font: 'var(--t-h2)', margin: '0 0 12px', color: 'var(--text-primary)' }}>{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 style={{ fontSize: 19, fontWeight: 700, margin: '28px 0 10px', color: 'var(--text-primary)' }}>{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 style={{ fontSize: 15, fontWeight: 700, margin: '20px 0 8px', color: 'var(--text-primary)' }}>{children}</h3>
  ),
  p: ({ children }) => (
    <p style={{ fontSize: 14, lineHeight: 1.8, margin: '10px 0', color: 'var(--text-primary)' }}>{children}</p>
  ),
  ul: ({ children }) => (
    <ul style={{ margin: '10px 0', paddingLeft: 20, fontSize: 14, lineHeight: 1.8, color: 'var(--text-primary)' }}>{children}</ul>
  ),
  ol: ({ children }) => (
    <ol style={{ margin: '10px 0', paddingLeft: 20, fontSize: 14, lineHeight: 1.8, color: 'var(--text-primary)' }}>{children}</ol>
  ),
  li: ({ children }) => <li style={{ marginBottom: 6 }}>{children}</li>,
  strong: ({ children }) => <strong style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{children}</strong>,
  blockquote: ({ children }) => (
    <blockquote
      style={{
        margin: '16px 0',
        borderLeft: '3px solid color-mix(in srgb, var(--primary) 40%, transparent)',
        backgroundColor: 'var(--surface-1)',
        padding: '8px 16px',
        fontSize: 13,
        color: 'var(--text-secondary)',
      }}
    >
      {children}
    </blockquote>
  ),
  hr: () => <hr style={{ margin: '24px 0', border: 'none', borderTop: '1px solid var(--hairline)' }} />,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
      {children}
    </a>
  ),
};

// ---------------------------------------------------------------------------
// 페이지
// ---------------------------------------------------------------------------

export function LegalPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const isValid = slug !== undefined && VALID_SLUGS.has(slug);

  const { data, isLoading, isError, refetch } = useQuery<LegalDocument>({
    queryKey: ['legal', slug],
    queryFn: () => apiFetch<LegalDocument>(`/api/legal/documents/${slug}`),
    enabled: isValid,
    staleTime: 1000 * 60 * 60, // 1시간 — 정책 문서는 자주 안 바뀜
  });

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
        <span style={{ font: 'var(--t-h3)' }}>{data?.title ?? ''}</span>
      </header>

      <main style={{ padding: '16px 20px 64px' }}>
        {!isValid && (
          <p style={{ font: 'var(--t-sub)', color: 'var(--warn)', textAlign: 'center', padding: '32px 0' }}>
            문서를 찾을 수 없어요.
          </p>
        )}
        {isValid && isLoading && <LoadingState />}
        {isValid && isError && <ErrorCard code="NETWORK_OFFLINE" onRetry={() => void refetch()} />}
        {isValid && data && (
          <>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {data.markdown}
            </ReactMarkdown>
            <p style={{ marginTop: 32, fontSize: 12, color: 'var(--text-secondary)' }}>
              버전 {data.version}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
