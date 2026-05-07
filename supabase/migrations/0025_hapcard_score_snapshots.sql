-- ADR-036: change_score 기준점 테이블
-- hapcard 생성/리플레이 시 snapshot upsert → 합피드 자동 정렬 기반 데이터
create table public.hapcard_score_snapshots (
  user_id uuid not null references auth.users(id) on delete cascade,
  relation_id uuid not null references public.relations(relation_id) on delete cascade,
  mode text not null check (mode in ('일합','친구합','돈합','첫합','썸합','오래합')),
  scoring_version text not null,
  prompt_version text not null,
  target_date date not null,
  compat_score numeric(5,2) not null,
  score_breakdown jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, relation_id, mode, scoring_version, prompt_version, target_date)
);

alter table public.hapcard_score_snapshots enable row level security;

create policy "user owns snapshots" on public.hapcard_score_snapshots
  for all using (user_id = auth.uid());

create index hapcard_score_snapshots_relation_idx
  on public.hapcard_score_snapshots (user_id, relation_id, created_at desc);
