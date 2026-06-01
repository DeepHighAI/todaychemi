import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface CheckResult {
  label: string;
  ok: boolean;
  detail: string;
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

function routeSpendsTokens(file: string, reason: string): boolean {
  const source = readRequired(file);
  return /rpc\('deduct_tokens(?:_once)?'/.test(source) && source.includes(reason);
}

function routeRefundsTokens(file: string, reason: string): boolean {
  const source = readRequired(file);
  return /rpc\('refund_tokens(?:_once)?'/.test(source) && source.includes(reason);
}

function main() {
  console.log('Billing policy readiness check');
  console.log('This command is read-only. It reports policy/code drift and does not decide pricing.');
  console.log('');

  const results: CheckResult[] = [];
  const prd = readRequired('PRD.md');
  const plan = readRequired('fluttering-gathering-island.md');
  const paymentsSpec = readRequired('docs/specs/payments.md');
  const dbSchemaSpec = readRequired('docs/specs/db_schema.md');
  const tokenLedgerMigration = readRequired('supabase/migrations/0009_token_ledger.sql');
  const tokenSpendMigration = readRequired('supabase/migrations/20260531031246_token_spend_idempotency.sql');
  const products = readRequired('src/lib/payments/products.ts');
  const whatifRouteTest = readRequired('tests/app/api/whatif/[type]/route.test.ts');

  addResult(
    results,
    'server product catalog matches PRD token packs',
    hasAll(products, [
      /tokens_10[\s\S]*tokens:\s*10[\s\S]*amount_krw:\s*1000/,
      /tokens_50[\s\S]*tokens:\s*55[\s\S]*amount_krw:\s*4500/,
      /tokens_100[\s\S]*tokens:\s*120[\s\S]*amount_krw:\s*8000/,
    ]),
    'expected 10/55/120 token packs at 1000/4500/8000 KRW',
  );

  addResult(
    results,
    'payments spec documents the implemented Toss product ids',
    hasAll(paymentsSpec, ['tokens_10', 'tokens_50', 'tokens_100', '10', '55', '120']),
    'docs/specs/payments.md includes token product ids and quantities',
  );

  addResult(
    results,
    'PRD contains the same launch token pack quantities and prices',
    hasAll(prd, ['10', '1,000', '55', '4,500', '120', '8,000']),
    'PRD.md Section 13 should agree with the server catalog',
  );

  const oldPlanPricingStillPresent = hasAll(plan, ['100p', '1,900', '500p', '7,900', '1,000p', '9,900'])
    || hasAll(plan, ['6,900', 'unlimited']);
  addResult(
    results,
    'planning document has no older conflicting pricing/subscription policy',
    !oldPlanPricingStillPresent,
    oldPlanPricingStillPresent
      ? 'fluttering-gathering-island.md still includes older 100p/500p/1000p or subscription pricing'
      : 'no older pricing block detected',
  );

  const prdContainsNoNewGateLine = prd.includes('v1') && prd.includes('신규 차감 게이트');
  const prdContainsPaidSpendLines = prd.includes('8p') && prd.includes('4p') && prd.includes('30p');
  addResult(
    results,
    'PRD launch spend policy is internally unambiguous',
    !(prdContainsNoNewGateLine && prdContainsPaidSpendLines),
    prdContainsNoNewGateLine && prdContainsPaidSpendLines
      ? 'PRD says no new v1 spend gate while also listing paid spend prices'
      : 'no contradictory spend-gate phrasing detected',
  );

  addResult(
    results,
    'token ledger accepts all launch billing reasons',
    hasAll(dbSchemaSpec, ['hapcard_use', 'hapcard_refund', 'replay_use', 'replay_refund', 'whatif_use', 'whatif_refund'])
      && hasAll(`${tokenLedgerMigration}\n${tokenSpendMigration}`, ['hapcard_use', 'hapcard_refund', 'replay_use', 'replay_refund', 'whatif_use', 'whatif_refund']),
    'schema docs and migrations include hapcard/replay/whatif use and refund reasons',
  );

  addResult(
    results,
    'replay route deducts and refunds launch tokens',
    routeSpendsTokens('src/app/api/hapcards/[id]/replay/route.ts', 'replay_use')
      && routeRefundsTokens('src/app/api/hapcards/[id]/replay/route.ts', 'replay_refund'),
    'replay currently spends 4 tokens and refunds on build failure',
  );

  const hapcardRouteIsPaid = routeSpendsTokens('src/app/api/hapcards/route.ts', 'hapcard_use');
  addResult(
    results,
    'hapcard create route billing policy is resolved in code',
    hapcardRouteIsPaid,
    hapcardRouteIsPaid
      ? 'hapcard create spends tokens'
      : 'hapcard create does not spend tokens while PRD lists hapcard spend pricing',
  );

  addResult(
    results,
    'hapcard create refunds launch tokens on build failure',
    routeRefundsTokens('src/app/api/hapcards/route.ts', 'hapcard_refund'),
    'hapcard create should refund its 8-token spend when generation fails after charge',
  );

  const whatifRouteIsPaid = routeSpendsTokens('src/app/api/whatif/[type]/route.ts', 'whatif_use');
  addResult(
    results,
    'whatif route billing policy is resolved in code',
    whatifRouteIsPaid,
    whatifRouteIsPaid
      ? 'whatif spends tokens'
      : 'whatif does not spend tokens while legal/payment docs treat whatif as paid content',
  );

  addResult(
    results,
    'whatif refunds launch tokens on build failure',
    routeRefundsTokens('src/app/api/whatif/[type]/route.ts', 'whatif_refund'),
    'whatif should refund its 5-token spend when generation fails after charge',
  );

  const whatifTestsLockFreeUse = whatifRouteTest.includes('deduct_tokens/refund_tokens')
    && whatifRouteTest.includes('not.toHaveBeenCalled');
  addResult(
    results,
    'whatif tests do not lock a launch-paid feature into free use',
    !whatifTestsLockFreeUse,
    whatifTestsLockFreeUse
      ? 'whatif route tests explicitly expect no token RPC calls'
      : 'whatif tests do not assert free token behavior',
  );

  addResult(
    results,
    'refund policy page exists for paid launch',
    existsSync(resolve(process.cwd(), 'docs/legal/refund_policy.md'))
      && existsSync(resolve(process.cwd(), 'src/app/legal/refund/page.tsx')),
    'refund policy documentation and legal page are present',
  );

  const failed = results.filter((result) => !result.ok);

  console.log('');
  console.log('Approved billing decisions applied:');
  console.log('- Token packs are 10/55/120 for 1,000/4,500/8,000 KRW.');
  console.log('- Hapcard create, replay, and whatif are paid with cache-hit no-charge behavior.');
  console.log('- Server routes, tests, docs, and DB migration evidence are present.');

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
