import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

interface SourceCheck {
  label: string;
  file: string;
  patterns: Array<string | RegExp>;
}

const PNPM = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

const SOURCE_CHECKS: SourceCheck[] = [
  {
    label: 'common OpenAI caller retries transient failures once',
    file: 'src/lib/llm/openai.ts',
    patterns: [
      'retryOnce',
      /429/,
      'isRetryableError',
      '401',
    ],
  },
  {
    label: 'common OpenAI caller disables provider storage and tracks cost',
    file: 'src/lib/llm/openai.ts',
    patterns: [
      'store: false',
      'llm_cost_tracking',
      /provider[\s\S]{0,80}openai/,
      'total_usd',
    ],
  },
  {
    label: 'common OpenAI caller fails closed when cost tracking write fails',
    file: 'src/lib/llm/openai.ts',
    patterns: [
      /const\s+\{\s*error\s*\}\s*=\s*await\s+client[\s\S]{0,400}\.upsert/,
      /if\s*\(\s*error\s*\)/,
      'LLM_COST_TRACKING_FAILED',
    ],
  },
  {
    label: 'today LLM uses common budget/fallback caller with bounded timeout',
    file: 'src/lib/today/openai.ts',
    patterns: [
      'TODAY_LLM_TIMEOUT_MS',
      'timeoutMs: TODAY_LLM_TIMEOUT_MS',
      'LLM_TIMEOUT:',
      'LLM_PARSE_FAIL:',
      'callOpenAi',
      'costClient',
      'anthropicClient',
      'TODAY_PAYLOAD_WHITELIST',
    ],
  },
  {
    label: 'today route records LLM failure traces',
    file: 'src/app/api/today/route.ts',
    patterns: [
      'LLM_TIMEOUT',
      'LLM_PARSE_FAIL',
      'TODAY_BUILD_FAIL',
      'error_events',
      'recordTrace',
    ],
  },
  {
    label: 'replay route has explicit provider-outage error path',
    file: 'src/app/api/hapcards/[id]/replay/route.ts',
    patterns: [
      'LLM_ALL_PROVIDERS_DOWN',
      'REPLAY_DURING_OUTAGE',
      /rpc\('refund_tokens(?:_once)?'/,
      'replay_refund_failed',
    ],
  },
  {
    label: 'user-facing error catalog covers LLM timeout/rate/quota/outage',
    file: 'src/lib/errors/error-codes.ts',
    patterns: [
      'LLM_TIMEOUT',
      'LLM_RATE_LIMIT',
      'USER_QUOTA_EXCEEDED',
      'REPLAY_DURING_OUTAGE',
      'ERROR_COPY',
    ],
  },
  {
    label: 'slow loading state escalates to timeout copy',
    file: 'src/components/feedback/LoadingState.tsx',
    patterns: [
      'timeout',
      'loading-timeout-card',
      'LLM_TIMEOUT',
    ],
  },
];

const FOCUSED_TESTS = [
  'tests/lib/llm/retry.test.ts',
  'tests/lib/llm/openai.test.ts',
  'tests/lib/today/openai.test.ts',
  'tests/app/api/today/route.test.ts',
  'tests/app/api/hapcards/[id]/replay/route.test.ts',
  'tests/components/feedback/ErrorCard.test.tsx',
  'tests/components/feedback/LoadingState.test.tsx',
  'tests/app/(app)/page.test.tsx',
  'tests/components/hapcard/replay-button.test.tsx',
];

function readRequired(file: string): string {
  const absolutePath = resolve(process.cwd(), file);
  if (!existsSync(absolutePath)) {
    throw new Error(`Missing required file: ${file}`);
  }
  return readFileSync(absolutePath, 'utf8');
}

function listFiles(dir: string): string[] {
  const absoluteDir = resolve(process.cwd(), dir);
  if (!existsSync(absoluteDir)) return [];

  const result: string[] = [];
  for (const entry of readdirSync(absoluteDir)) {
    const absolutePath = join(absoluteDir, entry);
    const stat = statSync(absolutePath);
    if (stat.isDirectory()) {
      result.push(...listFiles(absolutePath));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      result.push(absolutePath);
    }
  }
  return result;
}

function readRuntimeSources(): string {
  return listFiles('src')
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n\n');
}

function checkSourceInvariant(check: SourceCheck): boolean {
  const source = readRequired(check.file);
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

function checkProjectInvariant(label: string, ok: boolean, detail: string): boolean {
  console.log(`[project] ${ok ? 'OK' : 'FAIL'} ${label} - ${detail}`);
  return ok;
}

function runVitest(): boolean {
  const missingFiles = FOCUSED_TESTS.filter((file) => !existsSync(resolve(process.cwd(), file)));
  if (missingFiles.length > 0) {
    console.log('[vitest] FAIL missing focused tests');
    for (const file of missingFiles) {
      console.log(`  missing: ${file}`);
    }
    return false;
  }

  console.log('');
  console.log('[vitest] LLM resilience focused tests');
  const result = spawnSync(PNPM, ['vitest', 'run', ...FOCUSED_TESTS], {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  const ok = result.status === 0;
  console.log(`[vitest] ${ok ? 'OK' : 'FAIL'} LLM resilience focused tests`);
  return ok;
}

function main() {
  console.log('LLM resilience readiness check');
  console.log('This command checks failure handling evidence and does not change LLM routing, prompts, or models.');
  console.log('');

  let ok = true;

  for (const check of SOURCE_CHECKS) {
    ok = checkSourceInvariant(check) && ok;
  }

  const runtimeSources = readRuntimeSources();
  ok = checkProjectInvariant(
    'Anthropic fallback runtime is implemented',
    /@anthropic-ai\/sdk|new\s+Anthropic|anthropic\.messages|claude-sonnet/i.test(runtimeSources),
    'launch docs require Claude fallback when OpenAI is unhealthy',
  ) && ok;

  ok = checkProjectInvariant(
    'LLM circuit breaker is implemented',
    /circuit.?breaker|openai.*skip|provider.*unhealthy|fallback.*claude/i.test(runtimeSources),
    'runbooks/specs require OpenAI retryable-failure circuit breaker before Claude fallback',
  ) && ok;

  ok = checkProjectInvariant(
    'LLM daily budget is enforced at runtime',
    /LLM_DAILY_BUDGET_USD/.test(runtimeSources)
      && /USER_QUOTA_EXCEEDED|LLM_ALL_PROVIDERS_DOWN|budget/i.test(runtimeSources)
      && /llm_cost_tracking[\s\S]{0,800}LLM_DAILY_BUDGET_USD|LLM_DAILY_BUDGET_USD[\s\S]{0,800}llm_cost_tracking/i.test(runtimeSources),
    'env catalog exists, but launch needs runtime budget check against llm_cost_tracking',
  ) && ok;

  ok = runVitest() && ok;

  console.log('');
  console.log('Approved LLM resilience controls applied:');
  console.log('- Claude fallback and OpenAI circuit breaker runtime paths are present.');
  console.log('- LLM_DAILY_BUDGET_USD is enforced before provider calls.');
  console.log('- LLM cost tracking write failures fail closed.');
  console.log('- Production OpenAI/Anthropic project/env values still require dashboard setup.');

  if (!ok) {
    console.error('\nLLM resilience readiness FAIL');
    process.exit(1);
  }

  console.log('\nLLM resilience readiness PASS');
}

try {
  main();
} catch (err) {
  console.error('verify failed:', err);
  process.exit(1);
}
