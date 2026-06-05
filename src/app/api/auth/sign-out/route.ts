import { NextResponse } from 'next/server';

import { apiErrorResponse } from '@/lib/errors/route-response';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return apiErrorResponse('SIGN_OUT_FAILED', error.message, 500);
  }

  return NextResponse.json({ ok: true });
}
