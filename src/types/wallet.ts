import type { TossProductId } from '@/lib/payments/products';

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

export interface WalletProduct {
  product_id: TossProductId;
  tokens: number;
  amount_krw: number;
  order_name: string;
  label: string;
}

export interface PaymentInitResponse {
  ok: true;
  payment: {
    payment_id: string;
    toss_order_id: string;
    product_id: TossProductId;
    amount_krw: number;
    token_amount: number;
    order_name: string;
    status: string;
    customer_key: string;
  };
}

export interface PaymentOrderResponse {
  ok: true;
  order: {
    payment_id: string;
    toss_order_id: string;
    product_id: TossProductId;
    amount_krw: number;
    token_amount: number;
    order_name: string;
    status: string;
    client_key: string;
    customer_key: string;
  };
}
