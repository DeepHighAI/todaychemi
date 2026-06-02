import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
  const featurePrices = readRequired('src/lib/payments/feature-prices.ts');
  const featureMigration = 'supabase/migrations/20260601000000_feature_pay_per_use.sql';

  addResult(
    results,
    'feature price catalog matches pay-per-use prices',
    hasAll(featurePrices, [
      /hapcard:\s*\{[^}]*amount_krw:\s*800/,
      /whatif:\s*\{[^}]*amount_krw:\s*500/,
      /replay:\s*\{[^}]*amount_krw:\s*400/,
    ]),
    'feature-prices.ts: hapcard 800 / whatif 500 / replay 400 KRW',
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
      && routeRefundsTokens('src/app/api/hapcards/[id]/replay/route.ts', 'replay_refund'),
    'hapcard/whatif/replay refund their free-token spend when generation fails after charge',
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
  console.log('- Prices: hapcard 800 / whatif 500 / replay 400 KRW (feature-prices.ts single source).');
  console.log('- Free 부적 path refunds on build failure; cash path withholds body until paid.');

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
