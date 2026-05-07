-- v0.2 -> rolled_back (prompt_versions_one_active partial unique index 해소)
-- 0024 push 후 pnpm seed:prompts 실행 시 v0.3 active 6행 upsert 가능
UPDATE prompt_versions
SET status = 'rolled_back'
WHERE version = 'v0.2'
  AND status = 'active';
