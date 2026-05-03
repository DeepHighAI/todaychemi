import { describe, expect, expectTypeOf, it } from 'vitest';

import type { Database } from '@/types/database.types';

describe('Database types', () => {
  it('has 19 tables in public schema', () => {
    type Tables = keyof Database['public']['Tables'];
    const expected: Tables[] = [
      'users',
      'user_charts',
      'relations',
      'relation_charts',
      'hapcards',
      'hapcard_replays',
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
      'deletion_grace',
    ];
    expect(expected).toHaveLength(19);
  });

  it('relations.Row has nickname (ADR-011: 별명만)', () => {
    type Row = Database['public']['Tables']['relations']['Row'];
    expectTypeOf<Row>().toHaveProperty('nickname');
  });

  it('users.Row.gender is M or F', () => {
    type Row = Database['public']['Tables']['users']['Row'];
    expectTypeOf<Row['gender']>().toEqualTypeOf<'M' | 'F'>();
  });

  it('users.Row.birth_time_knowledge has 3 enum values', () => {
    type Row = Database['public']['Tables']['users']['Row'];
    expectTypeOf<Row['birth_time_knowledge']>().toEqualTypeOf<
      'exact' | 'approximate' | 'unknown'
    >();
  });

  it('hapcards.Row exposes compat_score as number', () => {
    type Row = Database['public']['Tables']['hapcards']['Row'];
    expectTypeOf<Row['compat_score']>().toEqualTypeOf<number>();
  });
});
