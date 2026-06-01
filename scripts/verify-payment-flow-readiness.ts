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
    label: 'Toss product catalog matches token launch packs',
    file: 'src/lib/payments/products.ts',
    patterns: [
      /tokens_10[\s\S]*tokens:\s*10[\s\S]*amount_krw:\s*1000/,
      /tokens_50[\s\S]*tokens:\s*55[\s\S]*amount_krw:\s*4500/,
      /tokens_100[\s\S]*tokens:\s*120[\s\S]*amount_krw:\s*8000/,
    ],
  },
  {
    label: 'Payment init stores Toss order and customer keys server-side',
    file: 'src/app/api/payments/init/route.ts',
    patterns: [
      'createTossOrderId',
      'createTossCustomerKey',
      'toss_customer_key',
      "status: 'pending'",
    ],
  },
  {
    label: 'Payment order route validates ownership, product amount, and status',
    file: 'src/app/api/payments/order/route.ts',
    patterns: [
      ".eq('user_id', user.id)",
      'PAYMENT_PRODUCT_MISMATCH',
      'PAYMENT_CUSTOMER_KEY_MISSING',
      'PAYMENT_ALREADY_CONFIRMED',
      'PAYMENT_NOT_PAYABLE',
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
    label: 'Server confirm validates amount and credits tokens through RPC',
    file: 'src/lib/payments/complete.ts',
    patterns: [
      'confirmTossPayment',
      'getTossPayment',
      'PAYMENT_AMOUNT_MISMATCH',
      "rpc('confirm_token_purchase'",
      'markPaymentTamperedForUser',
    ],
  },
  {
    label: 'Payment confirm route avoids logging raw paymentKey to Sentry extras',
    file: 'src/app/api/payments/confirm/route.ts',
    patterns: [
      "tags: { area: 'payments', payment_step: 'confirm' }",
      'extra: { order_id: orderId, code }',
      'redirectToFail',
      'redirectWithQuery',
    ],
  },
  {
    label: 'Charge UI uses server-created orders and canonical confirm/fail URLs',
    file: 'src/app/payments/charge/charge-client.tsx',
    patterns: [
      '/api/payments/init',
      '/api/payments/order?orderId=',
      'loadTossPayments',
      'requestPayment',
      '/api/payments/confirm',
      '/payments/fail',
    ],
  },
  {
    label: 'Replay spend path is idempotent, deducts tokens, and refunds on build failure',
    file: 'src/app/api/hapcards/[id]/replay/route.ts',
    patterns: [
      'hapcard_replays',
      "rpc('deduct_tokens'",
      "reason: 'replay_use'",
      "rpc('refund_tokens'",
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
    label: 'payment product/env/idempotency unit tests',
    files: [
      'tests/lib/payments/products.test.ts',
      'tests/lib/payments/ids.test.ts',
      'tests/lib/payments/env.test.ts',
      'tests/lib/payments/toss-server.test.ts',
    ],
  },
  {
    label: 'payment server route and completion tests',
    files: [
      'tests/lib/payments/complete.test.ts',
      'tests/app/api/payments/init/route.test.ts',
      'tests/app/api/payments/order/route.test.ts',
      'tests/app/api/payments/confirm/route.test.ts',
    ],
  },
  {
    label: 'payment UI result and wallet tests',
    files: [
      'tests/app/payments/charge/charge-client.test.tsx',
      'tests/app/payments/success/page.test.tsx',
      'tests/app/payments/fail/page.test.tsx',
      'tests/app/api/me/wallet/route.test.ts',
    ],
  },
  {
    label: 'token spend/refund replay tests',
    files: [
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
  console.log('- Production Supabase payment migration and protected RPC grants.');
  console.log('- Live charge/cancel/fail/refund smoke on the production domain.');

  if (!ok) {
    console.error('\nPayment flow readiness FAIL');
    process.exit(1);
  }

  console.log('\nPayment flow readiness PASS');
}

main();
