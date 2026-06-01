import { pathToFileURL } from 'node:url';

interface VercelEnvRow {
  key: string;
  source: string;
  note: string;
}

export const VERCEL_ENV_ROWS: VercelEnvRow[] = [
  {
    key: 'NEXT_PUBLIC_APP_URL',
    source: 'Vercel Production *.vercel.app origin',
    note: 'public origin only; no trailing slash/path',
  },
  {
    key: 'NEXT_PUBLIC_SUPABASE_URL',
    source: 'Supabase Project Settings > API',
    note: 'public URL',
  },
  {
    key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    source: 'Supabase Project Settings > API',
    note: 'public anon key',
  },
  {
    key: 'SUPABASE_SERVICE_ROLE_KEY',
    source: 'Supabase Project Settings > API',
    note: 'server-only secret; never paste into evidence',
  },
  {
    key: 'OPENAI_API_KEY',
    source: 'OpenAI ZDR production project',
    note: 'server-only secret; same project as OPENAI_PROJECT_ID',
  },
  {
    key: 'OPENAI_PROJECT_ID',
    source: 'OpenAI production project settings',
    note: 'record only id_prefix=proj_ in evidence',
  },
  {
    key: 'KASI_SERVICE_KEY',
    source: 'KASI API console',
    note: 'server-side API key',
  },
  {
    key: 'TOSS_CLIENT_KEY',
    source: 'TossPayments live dashboard',
    note: 'must start with live_ck_',
  },
  {
    key: 'TOSS_SECRET_KEY',
    source: 'TossPayments live dashboard',
    note: 'must start with live_sk_; server-only secret',
  },
  {
    key: 'NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY',
    source: 'Kakao Developers app keys',
    note: 'browser public key',
  },
  {
    key: 'KAKAO_ADMIN_KEY',
    source: 'Kakao Developers app keys',
    note: 'server-only callback verification key',
  },
  {
    key: 'LLM_DAILY_BUDGET_USD',
    source: 'operator decision',
    note: 'positive number; MVP default recommendation is 20',
  },
  {
    key: 'ANTHROPIC_API_KEY',
    source: 'Anthropic Console API Keys',
    note: 'server-only fallback secret',
  },
  {
    key: 'SENTRY_DSN',
    source: 'Sentry project DSN',
    note: 'server DSN; do not paste full DSN into evidence',
  },
  {
    key: 'NEXT_PUBLIC_SENTRY_DSN',
    source: 'Sentry project DSN',
    note: 'browser DSN; do not paste full DSN into evidence',
  },
];

export const VERCEL_ENV_UNSET_KEYS = [
  'TOSS_PAYMENTS_CLIENT_KEY',
  'TOSS_PAYMENTS_SECRET_KEY',
] as const;

function main() {
  console.log('Vercel environment setup plan');
  console.log('Scope: secret-free key checklist for Vercel Production and Preview.');
  console.log('Do not paste actual values into docs, PRs, issues, or chat.');
  console.log('');
  console.log('Set these keys in both Production and Preview:');
  for (const row of VERCEL_ENV_ROWS) {
    console.log(`- ${row.key}: source=${row.source}; ${row.note}`);
  }

  console.log('');
  console.log('Keep these legacy aliases unset for launch:');
  for (const key of VERCEL_ENV_UNSET_KEYS) console.log(`- ${key}`);

  console.log('');
  console.log('Recommended operator flow:');
  console.log('1. Choose the fixed Vercel Production *.vercel.app origin.');
  console.log('2. Run pnpm verify:origin-shape-readiness -- --origin https://<project>.vercel.app.');
  console.log('3. Add the keys above in Vercel Settings > Environment Variables.');
  console.log('4. Redeploy Vercel Production and Preview.');
  console.log('5. Run pnpm verify:external-settings-readiness.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
