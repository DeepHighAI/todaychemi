-- Server-owned legal consent evidence. Raw nonce tokens are issued as HttpOnly
-- cookies and never stored; only token_hash is persisted.

create table public.legal_consents (
  consent_id      uuid primary key default gen_random_uuid(),
  auth_user_id    uuid references auth.users(id) on delete cascade,
  token_hash      text not null unique,
  flow            text not null check (flow in ('email', 'oauth')),
  provider        text check (provider in ('google', 'kakao')),
  terms_version   text not null,
  privacy_version text not null,
  age_confirmed   boolean not null default false,
  consented_at    timestamptz not null default now(),
  expires_at      timestamptz not null,
  claimed_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint legal_consents_flow_provider_check check (
    (flow = 'email' and provider is null)
    or
    (flow = 'oauth' and provider is not null)
  )
);

create index if not exists legal_consents_auth_user_idx
  on public.legal_consents (auth_user_id, consented_at desc);

create index if not exists legal_consents_expires_idx
  on public.legal_consents (expires_at);

alter table public.legal_consents enable row level security;
-- No anon/authenticated policies. This table is service_role-only.
