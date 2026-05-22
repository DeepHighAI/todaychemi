'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { RoleAnalysis } from '@/types/hapcard';

interface HapcardRoleAnalysisProps {
  hapcardId: string;
  analysis?: RoleAnalysis;
}

async function fetchRoleAnalysis(hapcardId: string): Promise<RoleAnalysis> {
  const res = await fetch(`/api/hapcards/${hapcardId}/role-analysis`);
  if (!res.ok) throw new Error('ROLE_ANALYSIS_FETCH_FAILED');
  const body = await res.json() as { analysis?: RoleAnalysis };
  if (!body.analysis) throw new Error('ROLE_ANALYSIS_EMPTY');
  return body.analysis;
}

export function HapcardRoleAnalysis({ hapcardId, analysis }: HapcardRoleAnalysisProps) {
  const t = useTranslations('hapcard.roleAnalysis');
  const analysisQuery = useQuery({
    queryKey: ['hapcard-role-analysis', hapcardId],
    queryFn: () => fetchRoleAnalysis(hapcardId),
    enabled: !analysis,
    retry: false,
  });
  const resolved = analysis ?? analysisQuery.data;

  return (
    <div data-testid="hapcard-role-analysis" className="rounded-2xl bg-card p-5 space-y-4">
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-foreground">{resolved?.title ?? t('title')}</p>
        <p className="text-[14px] leading-[1.65] font-semibold text-muted-foreground">
          {resolved
            ? resolved.summary
            : analysisQuery.isError
              ? t('error')
              : t('loading')}
        </p>
      </div>

      {resolved && (
        <>
          <div className="grid gap-2">
            {resolved.roles.map((role) => (
              <section
                key={role.title}
                className="rounded-[var(--r-md)] bg-[var(--surface-1)] px-3.5 py-3 space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-[13px] font-extrabold text-foreground">{role.title}</h3>
                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-[11px] font-bold text-primary">
                    {role.sipsin}
                  </span>
                </div>
                <p className="text-[13px] leading-[1.6] text-muted-foreground">{role.body}</p>
              </section>
            ))}
          </div>

          <div className="space-y-2.5">
            {resolved.areas.map((area) => (
              <p key={area.title} className="text-[13px] leading-[1.7] text-foreground">
                <strong className="font-extrabold text-foreground">{area.title}</strong>
                <span aria-hidden className="font-extrabold text-primary"> = </span>
                <span>{area.body}</span>
              </p>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {resolved.basis.map((item) => (
              <span
                key={item}
                className="rounded-full bg-[var(--surface-1)] px-2.5 py-1.5 text-[11px] font-bold text-muted-foreground"
              >
                {item}
              </span>
            ))}
          </div>

          <p className="rounded-[12px] bg-primary/10 px-3 py-2.5 text-[13px] leading-[1.6] font-semibold text-primary">
            {resolved.tip}
          </p>
        </>
      )}
    </div>
  );
}
