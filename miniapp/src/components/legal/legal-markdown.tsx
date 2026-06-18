/**
 * legal-markdown.tsx — 법적 문서 마크다운 렌더 + 본문 fetch (공용)
 *
 * LegalPage(전체 페이지)와 LegalDocSheet(온보딩 바텀시트)가 공유한다.
 * 웹앱 `/api/legal/documents/:slug` 를 단일 출처로 사용(버전 항상 최신, 공개 GET).
 */

import { useQuery } from '@tanstack/react-query';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { apiFetch } from '@/lib/api/client';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorCard } from '@/components/feedback/ErrorCard';

export type LegalSlug = 'terms' | 'privacy' | 'refund';

export interface LegalDocument {
  slug: LegalSlug;
  title: string;
  version: string;
  markdown: string;
}

const VALID_SLUGS: ReadonlySet<string> = new Set(['terms', 'privacy', 'refund']);

export function isLegalSlug(slug: string | undefined): slug is LegalSlug {
  return slug !== undefined && VALID_SLUGS.has(slug);
}

// ---------------------------------------------------------------------------
// 마크다운 렌더 매핑 (인라인 스타일 — 미니앱 토큰)
// ---------------------------------------------------------------------------

export const legalMarkdownComponents: Components = {
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
// 본문 (fetch + 마크다운 렌더)
// ---------------------------------------------------------------------------

interface LegalDocContentProps {
  slug: LegalSlug;
}

export function LegalDocContent({ slug }: LegalDocContentProps) {
  const { data, isLoading, isError, refetch } = useQuery<LegalDocument>({
    queryKey: ['legal', slug],
    queryFn: () => apiFetch<LegalDocument>(`/api/legal/documents/${slug}`),
    staleTime: 1000 * 60 * 60, // 1시간 — 정책 문서는 자주 안 바뀜
  });

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorCard code="NETWORK_OFFLINE" onRetry={() => void refetch()} />;
  if (!data) return null;

  return (
    <>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={legalMarkdownComponents}>
        {data.markdown}
      </ReactMarkdown>
      <p style={{ marginTop: 32, fontSize: 12, color: 'var(--text-secondary)' }}>버전 {data.version}</p>
    </>
  );
}
