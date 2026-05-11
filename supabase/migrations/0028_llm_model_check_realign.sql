-- 0028_llm_model_check_realign.sql
-- Phase B 2026-05-11: 2e3bb09/40c1eaa CHECK drift fix (gpt-5-mini excluded from live DB)
alter table public.hapcards
  drop constraint if exists hapcards_llm_model_check;
alter table public.hapcards
  add constraint hapcards_llm_model_check
  check (llm_model in ('gpt-5o', 'gpt-5', 'gpt-5-mini', 'claude-fallback'));

alter table public.whatif_results
  drop constraint if exists whatif_results_llm_model_check;
alter table public.whatif_results
  add constraint whatif_results_llm_model_check
  check (llm_model in ('gpt-5o', 'gpt-5', 'gpt-5-mini', 'claude-fallback'));
