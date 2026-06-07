import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface SourceCheck {
  label: string;
  file: string;
  patterns: Array<string | RegExp>;
}

interface VitestRun {
  label: string;
  files: string[];
}

const PNPM = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

const SOURCE_CHECKS: SourceCheck[] = [
  {
    label: 'Feature price catalog matches pay-per-use launch prices',
    file: 'src/lib/payments/feature-prices.ts',
    patterns: [
      /hapcard:\s*\{[^}]*amount_krw:\s*1000[\s\S]*token_cost:\s*10/,
      /whatif:\s*\{[^}]*amount_krw:\s*800[\s\S]*token_cost:\s*8/,
      /replay:\s*\{[^}]*amount_krw:\s*600[\s\S]*token_cost:\s*6/,
    ],
  },
  {
    label: 'Feature payment init verifies owned refs and stores server-side Toss order data',
    file: 'src/app/api/payments/feature/init/route.ts',
    patterns: [
      'createTossOrderId',
      'createTossCustomerKey',
      'verifyFeatureRefOwnership',
      "charge_type: 'feature_use'",
      'feature_id',
      'feature_ref',
      'toss_customer_key',
      "status: 'pending'",
      "code !== '23505'",
      'getTossPaymentsClientKey',
    ],
  },
  {
    label: 'Feature payment confirm validates feature/ref/amount and unlocks through RPC',
    file: 'src/lib/payments/feature-complete.ts',
    patterns: [
      ".eq('user_id', input.userId)",
      "payment.charge_type !== 'feature_use'",
      'PAYMENT_FEATURE_MISMATCH',
      'PAYMENT_AMOUNT_MISMATCH',
      'confirmOrQueryTossPayment',
      "rpc('confirm_feature_payment'",
      'already_confirmed',
    ],
  },
  {
    label: 'Toss confirm uses provider idempotency without raw payment key in key material',
    file: 'src/lib/payments/toss-server.ts',
    patterns: [
      "'Idempotency-Key': buildConfirmIdempotencyKey(input)",
      "createHash('sha256')",
      'twoday_confirm_',
      'encodeURIComponent(paymentKey)',
    ],
  },
  {
    label: 'Feature confirm callback avoids raw paymentKey logging and redirects only to allowed app paths',
    file: 'src/app/api/payments/feature/confirm/route.ts',
    patterns: [
      "tags: { area: 'payments', payment_step: 'feature_confirm' }",
      'extra: { order_id: orderId, code, feature }',
      'resolveNext',
      "target.searchParams.set('paid', ref)",
      "if (!next || !next.startsWith('/') || next.startsWith('//'))",
      "/^\\/(hapcard|whatif)(\\/|$)/",
      'redirectToFail',
    ],
  },
  {
    label: 'Shared payment problem marker records failed/tampered/invalid states without token credit',
    file: 'src/lib/payments/complete.ts',
    patterns: [
      'confirmTossPayment',
      'getTossPayment',
      'PAYMENT_CONFIRM_RETRYABLE',
      'markPaymentFailedForUser',
      'markPaymentTamperedForUser',
      'markPaymentInvalidForUser',
      "status: 'tampered'",
      "status: 'invalid'",
    ],
  },
  {
    label: 'Feature pay sheet uses server-created orders and canonical feature confirm/fail URLs',
    file: 'src/components/payments/feature-pay-sheet.tsx',
    patterns: [
      '/api/payments/feature/init',
      'loadTossPayments',
      'requestPayment',
      '/api/payments/feature/confirm',
      '/payments/fail',
      'featureRef',
      "replay ? '&replay=1' : ''",
    ],
  },
  {
    label: 'Hapcard create path gates free tokens, cash generation, and paid unlocks',
    file: 'src/app/api/hapcards/route.ts',
    patterns: [
      "resolveFeatureCharge(serviceClient, userId, 'hapcard', cacheKey)",
      'checkCashGenLimit',
      'paymentRequiredResponse',
      "rpc('refund_tokens_once'",
      "reason: 'hapcard_refund'",
      'hapcard_refund_failed',
    ],
  },
  {
    label: 'Whatif path gates free tokens, cash generation, and paid unlocks',
    file: 'src/app/api/whatif/[type]/route.ts',
    patterns: [
      "resolveFeatureCharge(serviceClient, userId, 'whatif', cacheKey)",
      'checkCashGenLimit',
      'paymentRequiredResponse',
      "rpc('refund_tokens_once'",
      "reason: 'whatif_refund'",
      'whatif_refund_failed',
    ],
  },
  {
    label: 'Replay path gates free tokens, cash generation, paid unlocks, and idempotent refunds',
    file: 'src/app/api/hapcards/[id]/replay/route.ts',
    patterns: [
      'hapcard_replays',
      "resolveFeatureCharge(serviceClient, userId, 'replay', ref)",
      'checkCashGenLimit',
      'paymentRequiredResponse',
      "rpc('refund_tokens_once'",
      "reason: 'replay_refund'",
      'replay_refund_failed',
    ],
  },
  {
    label: 'Wallet route reads recent ledger for balance and full-month usage separately',
    file: 'src/app/api/me/wallet/route.ts',
    patterns: [
      'token_ledger',
      'balance_after',
      "lt('delta', 0)",
      "gte('created_at', monthStart.toISOString())",
      'monthly_used',
      'has_more',
    ],
  },
];

const VITEST_RUNS: VitestRun[] = [
  {
    label: 'payment catalog/env/idempotency unit tests',
    files: [
      'tests/lib/payments/feature-prices.test.ts',
      'tests/lib/payments/ids.test.ts',
      'tests/lib/payments/env.test.ts',
      'tests/lib/payments/toss-server.test.ts',
    ],
  },
  {
    label: 'feature payment server route and completion tests',
    files: [
      'tests/lib/payments/complete.test.ts',
      'tests/lib/payments/feature-complete.test.ts',
      'tests/app/api/payments/feature/init/route.test.ts',
      'tests/app/api/payments/feature/confirm/route.test.ts',
    ],
  },
  {
    label: 'feature payment UI result and wallet tests',
    files: [
      'tests/components/payments/feature-pay-sheet.test.tsx',
      'tests/app/payments/fail/page.test.tsx',
      'tests/app/api/me/wallet/route.test.ts',
    ],
  },
  {
    label: 'feature gate and paid route tests',
    files: [
      'tests/lib/payments/feature-gate.test.ts',
      'tests/lib/payments/feature-unlock.test.ts',
      'tests/lib/payments/feature-ref-ownership.test.ts',
      'tests/lib/payments/cash-gen-limit.test.ts',
      'tests/lib/errors/route-response.test.ts',
      'tests/app/api/hapcards/route.test.ts',
      'tests/app/api/whatif/[type]/route.test.ts',
      'tests/app/api/hapcards/[id]/replay/route.test.ts',
      'tests/lib/replay/builder.test.ts',
    ],
  },
];

function checkSourceInvariant(check: SourceCheck): boolean {
  const absolutePath = resolve(process.cwd(), check.file);
  if (!existsSync(absolutePath)) {
    console.log(`[source] FAIL ${check.label}: missing ${check.file}`);
    return false;
  }

  const source = readFileSync(absolutePath, 'utf8');
  const missing = check.patterns.filter((pattern) => {
    if (typeof pattern === 'string') return !source.includes(pattern);
    return !pattern.test(source);
  });

  if (missing.length > 0) {
    console.log(`[source] FAIL ${check.label}`);
    for (const pattern of missing) {
      console.log(`  missing: ${pattern.toString()}`);
    }
    return false;
  }

  console.log(`[source] OK ${check.label}`);
  return true;
}

function runVitest(run: VitestRun): boolean {
  const missingFiles = run.files.filter((file) => !existsSync(resolve(process.cwd(), file)));
  if (missingFiles.length > 0) {
    console.log(`[vitest] FAIL ${run.label}`);
    for (const file of missingFiles) {
      console.log(`  missing: ${file}`);
    }
    return false;
  }

  console.log('');
  console.log(`[vitest] ${run.label}`);
  const result = spawnSync(PNPM, ['vitest', 'run', ...run.files], {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  const ok = result.status === 0;
  console.log(`[vitest] ${ok ? 'OK' : 'FAIL'} ${run.label}`);
  return ok;
}

function main() {
  console.log('Payment flow readiness gate');
  console.log('This command checks local source invariants and focused tests; it does not call Toss or mutate Supabase.');
  console.log('');

  let ok = true;

  for (const check of SOURCE_CHECKS) {
    ok = checkSourceInvariant(check) && ok;
  }

  for (const run of VITEST_RUNS) {
    ok = runVitest(run) && ok;
  }

  console.log('');
  console.log('Manual launch checks still required:');
  console.log('- Toss live dashboard keys and allowed redirect URLs.');
  console.log('- Keep pnpm db:push:dry and verify:supabase-security-readiness PASS before production smoke.');
  console.log('- Live feature payment/cancel/fail/manual refund smoke on the production domain.');

  if (!ok) {
    console.error('\nPayment flow readiness FAIL');
    process.exit(1);
  }

  console.log('\nPayment flow readiness PASS');
}

main();
