-- supabase/migrations/0018_anon_requests.sql
create table public.anon_requests (
  ip_hash       text    not null,
  bucket_minute timestamptz not null,
  count         int     not null default 1,
  primary key   (ip_hash, bucket_minute)
);

alter table public.anon_requests enable row level security;
-- RLS enabled, no policies (service_role only)

-- 10분 지난 버킷 자동 삭제
select cron.schedule(
  'cleanup-anon-requests',
  '*/10 * * * *',
  $$delete from public.anon_requests where bucket_minute < now() - interval '10 minutes'$$
);
