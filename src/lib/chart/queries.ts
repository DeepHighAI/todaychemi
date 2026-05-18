import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

export async function fetchLatestUserChart(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
  return supabase
    .from('user_charts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
}

export async function fetchLatestUserChartForVersion(
  supabase: SupabaseClient<Database>,
  userId: string,
  theoryProfileVersion: string,
) {
  return supabase
    .from('user_charts')
    .select('chart_core, chart_hash')
    .eq('user_id', userId)
    .eq('theory_profile_version', theoryProfileVersion)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
}

export async function fetchLatestRelationChartForVersion(
  supabase: SupabaseClient<Database>,
  relationId: string,
  theoryProfileVersion: string,
) {
  return supabase
    .from('relation_charts')
    .select('chart_core, chart_hash')
    .eq('relation_id', relationId)
    .eq('theory_profile_version', theoryProfileVersion)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
}
