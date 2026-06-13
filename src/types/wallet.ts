// token_ledger.reason 정본 집합 (0009_token_ledger.sql 주석과 동기).
// purchase 는 구 충전 모델 하위호환(ADR-039 pay-per-use 전환 이전 행).
export type LedgerReason =
  | 'purchase'
  | 'hapcard_use'
  | 'hapcard_refund'
  | 'replay_use'
  | 'replay_refund'
  | 'whatif_use'
  | 'whatif_refund'
  | 'relation_slot_use'
  | 'relation_slot_refund'
  | 'refund'
  | 'bonus';

export interface LedgerEntry {
  ledger_id: string;
  user_id: string;
  delta: number;
  balance_after: number;
  reason: LedgerReason;
  reference_id: string | null;
  created_at: string;
}

export interface WalletBalance {
  balance: number;
  next_expiry_at: string | null;
  next_expiry_amount: number;
  monthly_used: number;
  monthly_buckets: number[];
}

export interface WalletResponse {
  ok: true;
  balance: WalletBalance;
  ledger: LedgerEntry[];
  has_more: boolean;
}
