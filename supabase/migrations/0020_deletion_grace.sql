-- supabase/migrations/0020_deletion_grace.sql
create or replace function public.purge_deleted_users()
returns void language plpgsql security definer as $$
begin
  -- 30일 grace period 경과 후 auth.users 삭제 (cascade 로 관련 데이터 삭제)
  delete from auth.users
  where id in (
    select user_id from public.users
    where deletion_requested_at is not null
      and deletion_requested_at < now() - interval '30 days'
  );
end $$;

select cron.schedule(
  'purge-deleted-users',
  '0 4 * * *',
  $$select public.purge_deleted_users()$$
);
