import { NextResponse } from 'next/server';

import { apiErrorResponse } from '@/lib/errors/route-response';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return apiErrorResponse('UNAUTHORIZED', '', 401);

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('user_id,deletion_requested_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileError) return apiErrorResponse('INTERNAL_ERROR', profileError.message, 500);
  if (!profile) return apiErrorResponse('NOT_ONBOARDED', '', 404);

  if (profile.deletion_requested_at) {
    return NextResponse.json({
      ok: true,
      deletion_requested_at: profile.deletion_requested_at,
      already_requested: true,
    });
  }

  const deletionRequestedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from('users')
    .update({
      deletion_requested_at: deletionRequestedAt,
      updated_at: deletionRequestedAt,
    })
    .eq('user_id', user.id);

  if (updateError) return apiErrorResponse('INTERNAL_ERROR', updateError.message, 500);

  return NextResponse.json({
    ok: true,
    deletion_requested_at: deletionRequestedAt,
    already_requested: false,
  });
}
