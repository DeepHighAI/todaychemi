import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  FEATURE_PRICES_KRW,
  OPENING_DISCOUNT_PERCENT,
  FREE_RELATION_SLOTS,
} from '../src/lib/payments/feature-prices';

interface CheckResult {
  label: string;
  ok: boolean;
  detail: string;
}

function exists(file: string): boolean {
  return existsSync(resolve(process.cwd(), file));
}

function readRequired(file: string): string {
  const absolutePath = resolve(process.cwd(), file);
  if (!existsSync(absolutePath)) {
    throw new Error(`Missing required file: ${file}`);
  }
  return readFileSync(absolutePath, 'utf8');
}

function hasAll(source: string, patterns: Array<string | RegExp>): boolean {
  return patterns.every((pattern) => {
    if (typeof pattern === 'string') return source.includes(pattern);
    return pattern.test(source);
  });
}

function addResult(results: CheckResult[], label: string, ok: boolean, detail: string) {
  results.push({ label, ok, detail });
  console.log(`[${ok ? 'OK' : 'FAIL'}] ${label} - ${detail}`);
}

// 유료 라우트가 무료 경로(부적 차감)에서 생성 실패 시 환불하는지 확인.
function routeRefundsTokens(file: string, reason: string): boolean {
  const source = readRequired(file);
  return /rpc\('refund_tokens(?:_once)?'/.test(source) && source.includes(reason);
}

function main() {
  console.log('Billing policy readiness check (pay-per-use, ADR-039)');
  console.log('This command is read-only. It reports policy/code drift and does not decide pricing.');
  console.log('');

  const results: CheckResult[] = [];
  const featureMigration = 'supabase/migrations/20260601000000_feature_pay_per_use.sql';

  // feature-prices.ts 를 직접 import 해 런타임 값으로 검증한다.
  // (텍스트 regex 는 `list_amount_krw: 1000` 의 부분문자열 `amount_krw: 1000` 에 오매칭되어
  //  2026-06-14 오픈할인 도입 후 실제 과금액을 검증하지 못했음 — 회귀 차단.)
  addResult(
    results,
    'feature price catalog matches pay-per-use prices (list + opening discount charge)',
    FEATURE_PRICES_KRW.hapcard.list_amount_krw === 1100 &&
      FEATURE_PRICES_KRW.whatif.list_amount_krw === 880 &&
      FEATURE_PRICES_KRW.replay.list_amount_krw === 880 &&
      FEATURE_PRICES_KRW.relation_slot.list_amount_krw === 1100 &&
      OPENING_DISCOUNT_PERCENT === 50 &&
      FEATURE_PRICES_KRW.hapcard.amount_krw === 550 &&
      FEATURE_PRICES_KRW.whatif.amount_krw === 440 &&
      FEATURE_PRICES_KRW.replay.amount_krw === 440 &&
      FEATURE_PRICES_KRW.relation_slot.amount_krw === 550 &&
      FREE_RELATION_SLOTS === 2,
    'list 1100/880/880/1100, opening -50% → charge 550/440/440/550 KRW, free slots 2',
  );

  addResult(
    results,
    'legacy token-pack catalog removed',
    !exists('src/lib/payments/products.ts') && !exists('src/lib/payments/token-costs.ts'),
    'products.ts and token-costs.ts no longer exist',
  );

  addResult(
    results,
    'feature payment routes exist',
    exists('src/app/api/payments/feature/init/route.ts')
      && exists('src/app/api/payments/feature/confirm/route.ts'),
    'api/payments/feature/{init,confirm} routes present',
  );

  addResult(
    results,
    'pay-per-use gates exist',
    exists('src/lib/payments/feature-unlock.ts')
      && exists('src/lib/payments/feature-gate.ts')
      && exists('src/lib/payments/feature-ref-ownership.ts'),
    'feature-unlock / feature-gate / feature-ref-ownership present',
  );

  addResult(
    results,
    'legacy token-charge routes removed',
    !exists('src/app/api/payments/init/route.ts')
      && !exists('src/app/api/payments/order/route.ts')
      && !exists('src/app/api/payments/confirm/route.ts')
      && !exists('src/app/payments/charge/page.tsx'),
    'old /api/payments/{init,order,confirm} and /payments/charge removed',
  );

  addResult(
    results,
    'pay-per-use migration present',
    exists(featureMigration)
      && hasAll(readRequired(featureMigration), [
        'confirm_feature_payment',
        'drop function if exists public.confirm_token_purchase',
      ]),
    'migration adds confirm_feature_payment and drops confirm_token_purchase',
  );

  addResult(
    results,
    'paid routes refund free-token spend on build failure',
    routeRefundsTokens('src/app/api/hapcards/route.ts', 'hapcard_refund')
      && routeRefundsTokens('src/app/api/whatif/[type]/route.ts', 'whatif_refund')
      && routeRefundsTokens('src/app/api/hapcards/[id]/replay/route.ts', 'replay_refund')
      && routeRefundsTokens('src/app/api/relations/route.ts', 'relation_slot_refund'),
    'hapcard/whatif/replay/relation_slot refund their free-token spend when creation fails after charge',
  );

  const relationSlotMigration = 'supabase/migrations/20260610000000_relation_slot_registration.sql';
  addResult(
    results,
    'relation_slot registration migration present (ADR-039 Amended)',
    exists(relationSlotMigration)
      && hasAll(readRequired(relationSlotMigration), [
        'pending_relation_registrations',
        "'relation_slot'",
        "'relation_slot_use'",
        "'relation_slot_refund'",
      ]),
    'migration stages drafts and whitelists relation_slot in payments CHECK + token_ledger idempotency',
  );

  addResult(
    results,
    'relations route gates 3rd+ registration behind relation_slot',
    hasAll(readRequired('src/app/api/relations/route.ts'), [
      'resolveFeatureCharge',
      "'relation_slot'",
      'FREE_RELATION_SLOTS',
      'materializeRelationSlot',
    ]),
    'POST /api/relations counts owned relations and charges relation_slot from the 3rd one',
  );

  addResult(
    results,
    'free-slot gate is atomic (TOCTOU blocked via conditional-insert RPC)',
    exists('supabase/migrations/20260610140000_free_relation_cap_rpc.sql')
      && hasAll(readRequired('supabase/migrations/20260610140000_free_relation_cap_rpc.sql'), [
        'insert_relation_if_under_free_cap',
        'where (select count(*) from public.relations where user_id',
        '< p_free_slots',
      ])
      && readRequired('src/app/api/relations/route.ts').includes('insertFreeRelationIfUnderCap'),
    'free registration uses an atomic INSERT...WHERE count RPC, not a 2-step count-then-insert',
  );

  addResult(
    results,
    'refund policy page exists for paid launch',
    exists('docs/legal/refund_policy.md') && exists('src/app/legal/refund/page.tsx'),
    'refund policy documentation and legal page are present',
  );

  const failed = results.filter((result) => !result.ok);

  console.log('');
  console.log('Pay-per-use billing policy (ADR-039):');
  console.log('- Token-bundle purchase removed; paid features charge at point of use.');
  console.log('- List prices: 1100/880/880/1100 KRW; opening -50% charge: 550/440/440/550 KRW (feature-prices.ts single source).');
  console.log('- Free 부적 path refunds on build failure; cash path withholds body until paid.');
  console.log('- Relations: first 2 free, 3rd+ charges relation_slot via staged pending drafts.');

  if (failed.length > 0) {
    console.error('\nBilling policy readiness FAIL');
    process.exit(1);
  }

  console.log('\nBilling policy readiness PASS');
}

try {
  main();
} catch (err) {
  console.error('verify failed:', err);
  process.exit(1);
}
