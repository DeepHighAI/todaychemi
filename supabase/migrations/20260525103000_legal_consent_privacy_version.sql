-- Store terms and privacy consent versions separately.
alter table public.users
  add column if not exists consented_privacy_version text;

update public.users
set consented_privacy_version = consented_tos_version
where consented_privacy_version is null;

alter table public.users
  alter column consented_privacy_version set not null;
