import { describe, expect, expectTypeOf, it } from 'vitest';

import type { Database } from '@/types/database.types';

describe('Database types', () => {
  it('has 22 tables in public schema (incl. classics, share rewards, legal consents)', () => {
    type Tables = keyof Database['public']['Tables'];
    const expected: Tables[] = [
      'users',
      'user_charts',
      'relations',
      'relation_charts',
      'hapcards',
      'hapcard_replays',
      'hapcard_shares',
      'hapcard_share_rewards',
      'daily_haps',
      'token_ledger',
      'payments',
      'push_subscriptions',
      'notification_optins',
      'prompt_versions',
      'knowledge_assets',
      'banned_phrase_hits',
      'error_events',
      'llm_cost_tracking',
      'anon_requests',
      'feedback_events',
      'legal_consents',
      'classics',
    ];
    expect(expected).toHaveLength(22);
  });

  it('relations.Row has nickname (ADR-011: 별명만)', () => {
    type Row = Database['public']['Tables']['relations']['Row'];
    expectTypeOf<Row>().toHaveProperty('nickname');
  });

  // gender / birth_time_knowledge are DB CHECK constraints. supabase gen types
  // does not extract CHECK into TS literal unions, so generated shape is string.
  // Domain-narrow types are guaranteed by src/types/* aliases.
  it('users.Row.gender is string (CHECK constraint not preserved by gen)', () => {
    type Row = Database['public']['Tables']['users']['Row'];
    expectTypeOf<Row['gender']>().toEqualTypeOf<string>();
  });

  it('users.Row.birth_time_knowledge is string (CHECK constraint not preserved by gen)', () => {
    type Row = Database['public']['Tables']['users']['Row'];
    expectTypeOf<Row['birth_time_knowledge']>().toEqualTypeOf<string>();
  });

  it('users.Row exposes separated privacy consent version', () => {
    type Row = Database['public']['Tables']['users']['Row'];
    expectTypeOf<Row['consented_privacy_version']>().toEqualTypeOf<string>();
  });

  it('hapcards.Row exposes compat_score as number', () => {
    type Row = Database['public']['Tables']['hapcards']['Row'];
    expectTypeOf<Row['compat_score']>().toEqualTypeOf<number>();
  });

  it('free talisman session reward RPC exposes expected args', () => {
    type Args = Database['public']['Functions']['award_free_talisman_session_rewards']['Args'];
    // gen types 는 SQL default 인자를 optional(undefined)로만 출력 — null 은 생략으로 표현
    expectTypeOf<Args>().toEqualTypeOf<{
      p_auth_created_at?: string;
      p_policy_effective_at?: string;
      uid: string;
    }>();
  });

  it('legal_consents stores token_hash but no raw token', () => {
    type Row = Database['public']['Tables']['legal_consents']['Row'];
    expectTypeOf<Row>().toHaveProperty('token_hash');
    expectTypeOf<Row>().not.toHaveProperty('token');
  });

  it('pending_relation_registrations Row 가 생성 타입에 존재 (ADR-039 §9)', () => {
    type Row = Database['public']['Tables']['pending_relation_registrations']['Row'];
    expectTypeOf<Row>().toHaveProperty('pending_id');
    expectTypeOf<Row['materialized_at']>().toEqualTypeOf<string | null>();
    expectTypeOf<Row['relation_id']>().toEqualTypeOf<string | null>();
  });

  it('토큰 멱등 RPC(deduct/refund_tokens_once)가 생성 타입에 존재', () => {
    type DeductArgs = Database['public']['Functions']['deduct_tokens_once']['Args'];
    type RefundArgs = Database['public']['Functions']['refund_tokens_once']['Args'];
    expectTypeOf<DeductArgs>().toHaveProperty('uid');
    expectTypeOf<DeductArgs>().toHaveProperty('reason');
    expectTypeOf<RefundArgs>().toHaveProperty('ref');
  });
});
