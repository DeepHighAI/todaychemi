import { createClient } from '@supabase/supabase-js';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!url || !key) {
    console.error('❌ 환경변수 누락: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const client = createClient(url, key);

  console.log('🔍 match_classics RPC 검증 중...');
  const { data, error } = await client.rpc('match_classics', {
    query_embedding: Array(1536).fill(0),
    match_count: 1,
    filter_statuses: ['approved_ai_pending_human'],
  });

  if (error) {
    console.error('❌ RPC 오류:', error.message);
    process.exit(1);
  } else {
    console.log(`✅ match_classics RPC 등록 확인 — rows: ${data?.length ?? 0}`);
  }
}

main();
