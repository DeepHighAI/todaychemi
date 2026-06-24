import { NextResponse } from 'next/server';

import { apiErrorResponse } from '@/lib/errors/route-response';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiErrorResponse('UNAUTHORIZED', '', 401);

  const service = createServiceRoleClient();
  const { data, error } = await service
    .from('analysis_jobs')
    .select('job_id, feature, ref, status, route_payload, result_path, error_code, started_at, updated_at, completed_at')
    .eq('user_id', user.id)
    .is('notified_at', null)
    .order('updated_at', { ascending: false })
    .limit(20);

  if (error) return apiErrorResponse('INTERNAL_ERROR', '', 500);
  return NextResponse.json({ jobs: data ?? [] });
}
