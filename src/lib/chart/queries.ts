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
