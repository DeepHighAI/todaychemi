import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SQL = fs.readFileSync(
  path.resolve(process.cwd(), 'supabase/migrations/20260601000000_feature_pay_per_use.sql'),
  'utf8',
);
const LOWER = SQL.toLowerCase();

describe('feature pay-per-use migration (ADR-039)', () => {
  it('payments에 charge_type / feature_id / feature_ref 를 추가한다', () => {
    expect(SQL).toContain('charge_type');
    expect(SQL).toContain('feature_id');
    expect(SQL).toContain('feature_ref');
    expect(SQL).toContain("'token_charge'");
    expect(SQL).toContain("'feature_use'");
  });

  it('token_amount nullable + feature_use shape 제약을 추가한다', () => {
    expect(LOWER).toContain('alter column token_amount drop not null');
    expect(SQL).toContain('payments_feature_use_shape');
  });

  it('동일 feature_ref 중복 주문 방지 partial unique index를 추가한다', () => {
    expect(SQL).toContain('payments_feature_open_uidx');
    expect(LOWER).toContain('create unique index');
  });

  it('confirm_feature_payment RPC를 만들되 token_ledger를 적립하지 않는다', () => {
    expect(LOWER).toContain('create or replace function public.confirm_feature_payment');
    // pay-per-use는 부적을 사지 않는다 — 결제확정만, 토큰 적립 절대 금지
    expect(LOWER).not.toContain('insert into public.token_ledger');
  });

  it('레거시 토큰충전 RPC(confirm_token_purchase)를 제거한다', () => {
    expect(LOWER).toContain('drop function if exists public.confirm_token_purchase');
  });
});
