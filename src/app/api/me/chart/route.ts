import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';
import type { ChartCore } from '@/types/chart';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const db = supabase as unknown as SupabaseClient;
    const { data, error } = await db
      .from('user_charts')
      .select('chart_core')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, code: 'INTERNAL_ERROR' }, { status: 500 });
    }

    const chart = data ? ((data as { chart_core: ChartCore }).chart_core) : null;
    return NextResponse.json({ ok: true, chart });
  } catch (err) {
    console.error('[/api/me/chart]', err);
    return NextResponse.json({ ok: false, code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
