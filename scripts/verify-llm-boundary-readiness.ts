import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface StaticCheck {
  file: string;
  label: string;
  pattern: RegExp;
}

const PNPM = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

const STATIC_CHECKS: StaticCheck[] = [
  {
    file: 'src/lib/llm/payload.ts',
    label: 'hapcard payload builder exposes only chart/mode/profile/time keys',
    pattern: /export interface LlmPayload[\s\S]*self_chart_core[\s\S]*relation_chart_core[\s\S]*theory_profile[\s\S]*question_slot[\s\S]*time_context/,
  },
  {
    file: 'src/lib/llm/openai.ts',
    label: 'common OpenAI caller rejects non-whitelisted payload keys',
    pattern: /PII_GUARD_VIOLATION/,
  },
  {
    file: 'src/lib/llm/openai.ts',
    label: 'common OpenAI caller disables provider storage',
    pattern: /\bstore\s*:\s*false\b/,
  },
  {
    file: 'src/lib/llm/openai.ts',
    label: 'common OpenAI caller blocks score leakage in LLM output',
    pattern: /findScoreLeak/,
  },
  {
    file: 'src/lib/today/openai.ts',
    label: 'today OpenAI caller delegates to common no-store caller',
    pattern: /callOpenAi[\s\S]*timeoutMs:\s*TODAY_LLM_TIMEOUT_MS/,
  },
  {
    file: 'src/lib/hapcard/builder.ts',
    label: 'hapcard score comes from deterministic computeScore before LLM content',
    pattern: /computeScore[\s\S]*buildLlmPayload[\s\S]*callOpenAi[\s\S]*compat_score:\s*scoreOutput\.score/,
  },
  {
    file: 'tests/lib/llm/payload.test.ts',
    label: 'PII and score-free LLM payload tests exist',
    pattern: /birth_date 부재[\s\S]*nickname 부재[\s\S]*score \/ compat_score/,
  },
  {
    file: 'tests/lib/scoring/determinism.test.ts',
    label: 'deterministic scoring regression test exists',
    pattern: /1000회 동일 결과/,
  },
];

const FOCUSED_TESTS = [
  'tests/lib/llm/payload.test.ts',
  'tests/lib/llm/openai.test.ts',
  'tests/lib/llm/output-schema.test.ts',
  'tests/lib/scoring/determinism.test.ts',
  'tests/lib/hapcard/builder.test.ts',
  'tests/lib/today/openai.test.ts',
  'tests/lib/whatif/builder.test.ts',
];

function checkStaticInvariant(check: StaticCheck): boolean {
  const fullPath = resolve(process.cwd(), check.file);
  if (!existsSync(fullPath)) {
    console.log(`[static] FAIL ${check.label} - missing ${check.file}`);
    return false;
  }

  const source = readFileSync(fullPath, 'utf8');
  const ok = check.pattern.test(source);
  console.log(`[static] ${ok ? 'OK' : 'FAIL'} ${check.label}`);
  return ok;
}

function runFocusedTests(): boolean {
  console.log('');
  console.log('Focused LLM/score boundary tests:');
  console.log(`$ ${PNPM} vitest run ${FOCUSED_TESTS.join(' ')}`);

  const result = spawnSync(PNPM, ['vitest', 'run', ...FOCUSED_TESTS], {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  return result.status === 0;
}

function main() {
  console.log('LLM/score boundary readiness check');
  console.log('Scope: PII minimization, store:false, score isolation, deterministic scoring evidence.');
  console.log('');

  let ok = true;
  for (const check of STATIC_CHECKS) {
    ok = checkStaticInvariant(check) && ok;
  }

  ok = runFocusedTests() && ok;

  console.log('');
  console.log('Manual checks still required:');
  console.log('- Production OpenAI project has confirmed ZDR status.');
  console.log('- Production prompt/model changes follow AGENTS.md Section 1.1 approval.');
  console.log('- Live monitoring confirms LLM timeout/rate-limit/error UX after deployment.');

  if (!ok) {
    console.error('\nLLM/score boundary readiness FAIL');
    process.exit(1);
  }

  console.log('\nLLM/score boundary readiness PASS');
}

main();
