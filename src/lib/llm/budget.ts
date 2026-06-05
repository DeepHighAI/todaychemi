import type { SupabaseClient } from '@supabase/supabase-js';

function parseBudgetUsd(): number | null {
  const raw = process.env.LLM_DAILY_BUDGET_USD;
  if (!raw) {
    const vercelEnv = process.env.VERCEL_ENV;
    const requiresBudget = vercelEnv === 'production' || vercelEnv === 'preview';
    if (requiresBudget) {
      throw new Error('USER_QUOTA_EXCEEDED: LLM_DAILY_BUDGET_USD is required in production');
    }
    return null;
  }

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('USER_QUOTA_EXCEEDED: LLM_DAILY_BUDGET_USD must be a positive number');
  }
  return value;
}

export async function enforceDailyLlmBudget(
  client: SupabaseClient,
  now = new Date(),
): Promise<void> {
  const budgetUsd = parseBudgetUsd();
  if (budgetUsd === null) return;

  const date = now.toISOString().slice(0, 10);
  const { data, error } = await client
    .from('llm_cost_tracking')
    .select('total_usd')
    .eq('date', date);

  if (error) {
    throw new Error(`USER_QUOTA_EXCEEDED: budget lookup failed: ${error.message}`);
  }

  const spentUsd = ((data ?? []) as Array<{ total_usd?: number | string | null }>)
    .reduce((sum, row) => sum + Number(row.total_usd ?? 0), 0);

  if (spentUsd >= budgetUsd) {
    throw new Error(`USER_QUOTA_EXCEEDED: LLM daily budget exceeded (${spentUsd}/${budgetUsd} USD)`);
  }
}
