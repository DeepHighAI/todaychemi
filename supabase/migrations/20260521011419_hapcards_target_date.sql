-- Daily hapcard identity: same relation/mode is re-analyzed per KST date.
alter table public.hapcards
  add column target_date date;

update public.hapcards
set target_date = (created_at at time zone 'Asia/Seoul')::date
where target_date is null;

alter table public.hapcards
  alter column target_date set not null;

create index hapcards_daily_lookup_idx
  on public.hapcards (user_id, relation_id, mode, target_date desc);
