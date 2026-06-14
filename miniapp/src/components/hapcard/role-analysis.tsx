/**
 * role-analysis.tsx — 역할 분석 (미니앱 포트)
 *
 * 웹앱 원본: src/components/hapcard/role-analysis.tsx
 * 변경: Tailwind → 인라인 스타일, 'use client' 제거, fetch → VITE_API_BASE_URL.
 */

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { RoleAnalysis } from '@/types/hapcard';

interface HapcardRoleAnalysisProps {
  hapcardId: string;
  analysis?: RoleAnalysis;
  /** Bearer 토큰 (인증 필요 경로) */
  token?: string | null;
}

async function fetchRoleAnalysis(hapcardId: string, token?: string | null): Promise<RoleAnalysis> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'https://todaychemi.vercel.app';
  const res = await fetch(`${base}/api/hapcards/${hapcardId}/role-analysis`, { headers });
  if (!res.ok) throw new Error('ROLE_ANALYSIS_FETCH_FAILED');
  const body = await res.json() as { analysis?: RoleAnalysis };
  if (!body.analysis) throw new Error('ROLE_ANALYSIS_EMPTY');
  return body.analysis;
}

export function HapcardRoleAnalysis({ hapcardId, analysis, token }: HapcardRoleAnalysisProps) {
  const t = useTranslations('hapcard.roleAnalysis');
  const analysisQuery = useQuery({
    queryKey: ['hapcard-role-analysis', hapcardId],
    queryFn: () => fetchRoleAnalysis(hapcardId, token),
    enabled: !analysis,
    retry: false,
  });
  const resolved = analysis ?? analysisQuery.data;

  return (
    <div data-testid="hapcard-role-analysis" style={{ borderRadius: 16, backgroundColor: 'var(--bg-card)', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{resolved?.title ?? t('title')}</p>
        <p style={{ fontSize: 14, lineHeight: 1.65, fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>
          {resolved
            ? resolved.summary
            : analysisQuery.isError
              ? t('error')
              : t('loading')}
        </p>
      </div>

      {resolved && (
        <>
          {/* 역할 섹션 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {resolved.roles.map((role) => (
              <section
                key={role.title}
                style={{ borderRadius: 'var(--r-md)', backgroundColor: 'var(--surface-1)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{role.title}</h3>
                  <span style={{ flexShrink: 0, borderRadius: 'var(--r-pill)', backgroundColor: 'color-mix(in srgb, var(--primary) 10%, transparent)', padding: '4px 8px', fontSize: 11, fontWeight: 700, color: 'var(--primary)' }}>
                    {role.sipsin}
                  </span>
                </div>
                <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)', margin: 0 }}>{role.body}</p>
              </section>
            ))}
          </div>

          {/* 영역 분석 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {resolved.areas.map((area) => (
              <p key={area.title} style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-primary)', margin: 0 }}>
                <strong style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{area.title}</strong>
                <span aria-hidden style={{ fontWeight: 800, color: 'var(--primary)' }}> = </span>
                <span>{area.body}</span>
              </p>
            ))}
          </div>

          {/* 근거 태그 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {resolved.basis.map((item) => (
              <span
                key={item}
                style={{ borderRadius: 'var(--r-pill)', backgroundColor: 'var(--surface-1)', padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}
              >
                {item}
              </span>
            ))}
          </div>

          {/* 실전 팁 */}
          <p style={{ borderRadius: 12, backgroundColor: 'color-mix(in srgb, var(--primary) 10%, transparent)', padding: '10px 12px', fontSize: 13, lineHeight: 1.6, fontWeight: 600, color: 'var(--primary)', margin: 0 }}>
            {resolved.tip}
          </p>
        </>
      )}
    </div>
  );
}
