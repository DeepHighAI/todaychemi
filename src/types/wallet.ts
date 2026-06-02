export type LedgerReason =
  | 'purchase'
  | 'hapcard_use'
  | 'hapcard_refund'
  | 'replay_use'
  | 'replay_refund'
  | 'whatif_use'
  | 'whatif_refund'
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
