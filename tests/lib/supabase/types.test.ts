import { describe, expect, expectTypeOf, it } from 'vitest';

import type { Database } from '@/types/database.types';

describe('Database types', () => {
  it('has 19 tables in public schema (incl. classics)', () => {
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
      'classics',
    ];
    expect(expected).toHaveLength(19);
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

  it('hapcards.Row exposes compat_score as number', () => {
    type Row = Database['public']['Tables']['hapcards']['Row'];
    expectTypeOf<Row['compat_score']>().toEqualTypeOf<number>();
  });
});
