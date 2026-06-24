import type { SupabaseClient } from '@supabase/supabase-js';

import { sanitizeErrorForLog } from '@/lib/errors/sanitize-log';
import type { Database, Json } from '@/types/database.types';

type ServiceClient = SupabaseClient<Database>;

export type AnalysisJobFeature = 'hapcard' | 'whatif' | 'replay';
export type AnalysisJobStatus = 'running' | 'completed' | 'payment_required' | 'failed';

interface BaseJobInput {
  userId: string;
  feature: AnalysisJobFeature;
  ref: string;
}

interface StartJobInput extends BaseJobInput {
  routePayload: Json;
  resultPath?: string | null;
}

interface FinishJobInput extends BaseJobInput {
  resultPath?: string | null;
  errorCode?: string | null;
}

export async function startAnalysisJob(
  service: ServiceClient,
  input: StartJobInput,
): Promise<void> {
  try {
    const { data: existing, error: existingError } = await service
      .from('analysis_jobs')
      .select('status, notified_at')
      .eq('user_id', input.userId)
      .eq('feature', input.feature)
      .eq('ref', input.ref)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing?.status === 'completed' && existing.notified_at) {
      return;
    }

    const { error } = await service
      .from('analysis_jobs')
      .upsert(
        {
          user_id: input.userId,
          feature: input.feature,
          ref: input.ref,
          status: 'running',
          route_payload: input.routePayload,
          result_path: input.resultPath ?? null,
          error_code: null,
          completed_at: null,
          notified_at: null,
        },
        { onConflict: 'user_id,feature,ref' },
      );
    if (error) throw error;
  } catch (err) {
    console.error('analysis_job_start_failed', {
      feature: input.feature,
      ref: input.ref,
      error: sanitizeErrorForLog(err),
    });
  }
}

export async function completeAnalysisJob(
  service: ServiceClient,
  input: FinishJobInput,
): Promise<void> {
  await updateAnalysisJob(service, input, 'completed');
}

export async function paymentRequiredAnalysisJob(
  service: ServiceClient,
  input: FinishJobInput,
): Promise<void> {
  await updateAnalysisJob(service, input, 'payment_required');
}

export async function failAnalysisJob(
  service: ServiceClient,
  input: FinishJobInput,
): Promise<void> {
  await updateAnalysisJob(service, input, 'failed');
}

async function updateAnalysisJob(
  service: ServiceClient,
  input: FinishJobInput,
  status: AnalysisJobStatus,
): Promise<void> {
  try {
    if (status === 'completed') {
      const { data: existing, error: existingError } = await service
        .from('analysis_jobs')
        .select('status, notified_at')
        .eq('user_id', input.userId)
        .eq('feature', input.feature)
        .eq('ref', input.ref)
        .maybeSingle();

      if (existingError) throw existingError;
      if (existing?.status === 'completed' && existing.notified_at) {
        return;
      }
    }

    const completedAt = status === 'running' ? null : new Date().toISOString();
    const { error } = await service
      .from('analysis_jobs')
      .update({
        status,
        result_path: input.resultPath ?? null,
        error_code: input.errorCode ?? null,
        completed_at: completedAt,
        notified_at: null,
      })
      .eq('user_id', input.userId)
      .eq('feature', input.feature)
      .eq('ref', input.ref);
    if (error) throw error;
  } catch (err) {
    console.error('analysis_job_update_failed', {
      feature: input.feature,
      ref: input.ref,
      status,
      error: sanitizeErrorForLog(err),
    });
  }
}
