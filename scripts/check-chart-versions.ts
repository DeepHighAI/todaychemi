import { createClient } from '@supabase/supabase-js';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const c = createClient(url, key);

  const { data: charts } = await c
    .from('user_charts')
    .select('user_id, theory_profile_version, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
  console.log('user_charts:', JSON.stringify(charts, null, 2));

  const { data: rcharts } = await c
    .from('relation_charts')
    .select('relation_id, theory_profile_version, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
  console.log('relation_charts:', JSON.stringify(rcharts, null, 2));
}

main();
