import { NextResponse } from 'next/server';

import { apiErrorResponse } from '@/lib/errors/route-response';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const jobId = typeof json?.job_id === 'string' ? json.job_id : '';
  if (!jobId) return apiErrorResponse('INVALID_BODY', '', 400);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiErrorResponse('UNAUTHORIZED', '', 401);

  const service = createServiceRoleClient();
  const { error } = await service
    .from('analysis_jobs')
    .update({ notified_at: new Date().toISOString() })
    .eq('job_id', jobId)
    .eq('user_id', user.id);
  if (error) return apiErrorResponse('INTERNAL_ERROR', '', 500);

  return NextResponse.json({ ok: true });
}
