import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, X } from 'lucide-react';

import { apiFetch } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthProvider';

type AnalysisJobStatus = 'running' | 'completed' | 'payment_required' | 'failed';
type AnalysisJobFeature = 'hapcard' | 'whatif' | 'replay';

interface AnalysisJob {
  job_id: string;
  feature: AnalysisJobFeature;
  ref: string;
  status: AnalysisJobStatus;
  route_payload: Record<string, unknown>;
  result_path: string | null;
  error_code: string | null;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface AnalysisJobsResponse {
  jobs: AnalysisJob[];
}

const STALE_RUNNING_MS = 45_000;

function titleForJob(job: AnalysisJob): string {
  if (job.status === 'completed') return '분석이 완료되었어요';
  if (job.status === 'payment_required') return '분석이 준비됐어요';
  return '분석을 완료하지 못했어요';
}

function bodyForJob(job: AnalysisJob): string {
  if (job.status === 'completed') return '결과 화면에서 바로 확인할 수 있어요.';
  if (job.status === 'payment_required') return '부적이 부족해 결제가 필요해요.';
  return '잠시 후 다시 시도해 주세요.';
}

function isStaleRunning(job: AnalysisJob): boolean {
  if (job.status !== 'running') return false;
  const updatedAt = new Date(job.updated_at).getTime();
  return Number.isFinite(updatedAt) && Date.now() - updatedAt > STALE_RUNNING_MS;
}

export function AnalysisJobNotifier() {
  const { token, isAuthed } = useAuth();
  const navigate = useNavigate();
  const [active, setActive] = useState<AnalysisJob | null>(null);
  const resumedRefs = useRef(new Set<string>());
  const showingRef = useRef<string | null>(null);

  const markNotified = useCallback((jobId: string) => {
    void apiFetch('/api/analysis-jobs/mark-notified', {
      method: 'POST',
      token,
      body: { job_id: jobId },
    }).catch(() => undefined);
  }, [token]);

  const resumeJob = useCallback((job: AnalysisJob) => {
    if (resumedRefs.current.has(job.job_id)) return;
    resumedRefs.current.add(job.job_id);
    const payload = job.route_payload ?? {};
    if (job.feature === 'hapcard') {
      void apiFetch('/api/hapcards', { method: 'POST', token, body: payload }).catch(() => undefined);
      return;
    }
    if (job.feature === 'whatif' && typeof payload.type === 'string') {
      void apiFetch(`/api/whatif/${payload.type}`, { method: 'POST', token }).catch(() => undefined);
      return;
    }
    if (job.feature === 'replay' && typeof payload.hapcard_id === 'string') {
      void apiFetch(`/api/hapcards/${payload.hapcard_id}/replay`, { method: 'POST', token }).catch(() => undefined);
    }
  }, [token]);

  const refreshJobs = useCallback(() => {
    if (!isAuthed) return;
    void apiFetch<AnalysisJobsResponse>('/api/analysis-jobs', { token })
      .then((body) => {
        const jobs = body.jobs ?? [];
        for (const job of jobs) {
          if (isStaleRunning(job)) resumeJob(job);
        }
        if (showingRef.current) return;
        const next = jobs.find((job) => (
          job.status === 'completed' ||
          job.status === 'payment_required' ||
          job.status === 'failed'
        ));
        if (!next) return;
        showingRef.current = next.job_id;
        setActive(next);
        markNotified(next.job_id);
      })
      .catch(() => undefined);
  }, [isAuthed, markNotified, resumeJob, token]);

  useEffect(() => {
    refreshJobs();
  }, [refreshJobs]);

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible') refreshJobs();
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [refreshJobs]);

  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => {
      showingRef.current = null;
      setActive(null);
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [active]);

  if (!active) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        left: 16,
        right: 16,
        bottom: 'calc(var(--tabbar-h) + env(safe-area-inset-bottom) + 76px)',
        zIndex: 36,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: 'min(100%, 360px)',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          borderRadius: 'var(--r-lg)',
          border: '1px solid var(--hairline)',
          backgroundColor: 'var(--bg-card)',
          boxShadow: 'var(--e-3)',
          padding: '12px 12px 12px 14px',
          pointerEvents: 'auto',
        }}
      >
        <CheckCircle2 size={22} aria-hidden color="var(--primary)" />
        <button
          type="button"
          onClick={() => {
            const path = active.result_path;
            showingRef.current = null;
            setActive(null);
            if (path) navigate(path);
          }}
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            background: 'transparent',
            padding: 0,
            textAlign: 'left',
            cursor: active.result_path ? 'pointer' : 'default',
          }}
        >
          <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
            {titleForJob(active)}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 12, lineHeight: 1.45, color: 'var(--text-secondary)' }}>
            {bodyForJob(active)}
          </p>
        </button>
        <button
          type="button"
          aria-label="분석 알림 닫기"
          onClick={() => {
            showingRef.current = null;
            setActive(null);
          }}
          style={{
            width: 36,
            height: 36,
            borderRadius: 'var(--r-pill)',
            border: 'none',
            backgroundColor: 'transparent',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
