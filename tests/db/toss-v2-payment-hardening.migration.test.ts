import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SQL = fs.readFileSync(
  path.resolve(process.cwd(), 'supabase/migrations/20260530090000_toss_v2_payment_hardening.sql'),
  'utf8',
);

describe('Toss V2 payment hardening migration', () => {
  it('payments에 Toss customerKey와 tamper/invalid 상태를 추가한다', () => {
    expect(SQL).toContain('toss_customer_key');
    expect(SQL).toContain("'tampered'");
    expect(SQL).toContain("'invalid'");
    expect(SQL).toContain('payments_toss_order_id_format_check');
    expect(SQL).toContain('payments_toss_customer_key_format_check');
  });

  it('purchase ledger 중복 지급 방지 partial unique index를 추가한다', () => {
    expect(SQL).toContain('token_ledger_purchase_reference_unique_idx');
    expect(SQL).toContain("where reason = 'purchase' and reference_id is not null");
  });
});
