import { NextResponse } from 'next/server';

import { apiErrorResponse } from '@/lib/errors/route-response';
import { createClient } from '@/lib/supabase/server';
import type { LedgerEntry, WalletResponse } from '@/types/wallet';

const LEDGER_LIMIT = 20;
const MONTHLY_BUCKETS = 14;

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return apiErrorResponse('UNAUTHORIZED', '', 401);
    }

    const { data: ledgerRows, error: ledgerError } = await supabase
      .from('token_ledger')
      .select('ledger_id,user_id,delta,balance_after,reason,reference_id,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(LEDGER_LIMIT + 1);

    if (ledgerError) {
      return apiErrorResponse('INTERNAL_ERROR', ledgerError.message, 500);
    }

    const ledger = (ledgerRows ?? []).slice(0, LEDGER_LIMIT) as LedgerEntry[];
    const latest = ledger[0];
    const monthlyBuckets = buildMonthlyBuckets(ledger);
    const monthlyUsed = ledger
      .filter((row) => row.delta < 0)
      .reduce((sum, row) => sum + Math.abs(row.delta), 0);

    const body: WalletResponse = {
      ok: true,
      balance: {
        balance: latest?.balance_after ?? 0,
        next_expiry_at: null,
        next_expiry_amount: 0,
        monthly_used: monthlyUsed,
        monthly_buckets: monthlyBuckets,
      },
      ledger,
      has_more: (ledgerRows?.length ?? 0) > LEDGER_LIMIT,
    };

    return NextResponse.json(body);
  } catch (err) {
    console.error('[/api/me/wallet]', err);
    return apiErrorResponse('INTERNAL_ERROR', '', 500);
  }
}

function buildMonthlyBuckets(ledger: LedgerEntry[]): number[] {
  const today = new Date();
  const buckets = Array.from({ length: MONTHLY_BUCKETS }, () => 0);
  const start = new Date(today);
  start.setDate(today.getDate() - MONTHLY_BUCKETS + 1);
  start.setHours(0, 0, 0, 0);

  for (const row of ledger) {
    if (row.delta >= 0) continue;
    const created = new Date(row.created_at);
    const diffMs = created.getTime() - start.getTime();
    const index = Math.floor(diffMs / 86_400_000);
    if (index >= 0 && index < MONTHLY_BUCKETS) {
      buckets[index] += Math.abs(row.delta);
    }
  }

  return buckets;
}
