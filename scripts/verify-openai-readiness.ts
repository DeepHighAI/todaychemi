import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PNPM = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

function parseEnvFile(path: string): Map<string, string> {
  const entries = new Map<string, string>();
  if (!existsSync(path)) return entries;

  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) continue;

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    entries.set(key, value);
  }

  return entries;
}

function loadEnv(envFile: string): Map<string, string> {
  const env = parseEnvFile(envFile);
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string' && value.length > 0) env.set(key, value);
  }
  return env;
}

function hasValue(env: Map<string, string>, key: string): boolean {
  return (env.get(key) ?? '').trim().length > 0;
}

function checkOpenAiProjectIdShape(env: Map<string, string>): boolean {
  const projectId = env.get('OPENAI_PROJECT_ID')?.trim();
  if (!projectId) {
    console.log('[env] FAIL OPENAI_PROJECT_ID uses proj_* format');
    return false;
  }

  const ok = /^proj_[A-Za-z0-9]+$/.test(projectId);
  console.log(`[env] ${ok ? 'OK' : 'FAIL'} OPENAI_PROJECT_ID uses proj_* format`);
  return ok;
}

function readSource(path: string): string {
  const fullPath = resolve(process.cwd(), path);
  if (!existsSync(fullPath)) {
    console.log(`[source] FAIL missing ${path}`);
    return '';
  }
  return readFileSync(fullPath, 'utf8');
}

function checkContains(label: string, source: string, pattern: RegExp): boolean {
  const ok = pattern.test(source);
  console.log(`[${label}] ${ok ? 'OK' : 'FAIL'}`);
  return ok;
}

function runModelAccessCheck(env: Map<string, string>): boolean {
  const apiKey = env.get('OPENAI_API_KEY')?.trim();
  const projectId = env.get('OPENAI_PROJECT_ID')?.trim();
  const projectShapeOk = projectId ? /^proj_[A-Za-z0-9]+$/.test(projectId) : false;

  if (!apiKey || !projectId || !projectShapeOk) {
    console.log('[models] SKIP GPT-5/GPT-5 mini access check until OPENAI_API_KEY and valid OPENAI_PROJECT_ID are configured');
    return true;
  }

  console.log('');
  console.log('OpenAI model access check:');
  const result = spawnSync(PNPM, ['verify:llm-models'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: process.platform === 'win32',
    timeout: 60_000,
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  const ok = result.status === 0;
  console.log(`[models] ${ok ? 'OK' : 'FAIL'} GPT-5/GPT-5 mini access for configured OpenAI project`);
  return ok;
}

function main() {
  const envArgIndex = process.argv.indexOf('--env-file');
  const envFile = envArgIndex >= 0
    ? resolve(process.cwd(), process.argv[envArgIndex + 1] ?? '')
    : resolve(process.cwd(), '.env.local');
  const env = loadEnv(envFile);

  let ok = true;

  console.log('OpenAI readiness check');
  console.log(`Env source: ${envFile} + process.env`);
  console.log('');

  for (const key of ['OPENAI_API_KEY', 'OPENAI_PROJECT_ID']) {
    const present = hasValue(env, key);
    console.log(`[env] ${present ? 'OK' : 'FAIL'} ${key}`);
    ok = present && ok;
  }
  ok = checkOpenAiProjectIdShape(env) && ok;

  const sdkClient = readSource('src/lib/llm/clients.ts');
  ok = checkContains(
    'main OpenAI client reads OPENAI_PROJECT_ID',
    sdkClient,
    /OPENAI_PROJECT_ID/,
  ) && ok;
  ok = checkContains(
    'main OpenAI client passes project option',
    sdkClient,
    /\bproject\s*:/,
  ) && ok;

  const llmOpenAi = readSource('src/lib/llm/openai.ts');
  ok = checkContains(
    'hapcard/replay/whatif OpenAI calls disable storage',
    llmOpenAi,
    /\bstore\s*:\s*false\b/,
  ) && ok;
  ok = checkContains(
    'hapcard payload guard exists',
    llmOpenAi,
    /PII_GUARD_VIOLATION/,
  ) && ok;
  ok = checkContains(
    'legacy OpenAI factory export uses canonical project-routed client',
    llmOpenAi,
    /export\s*\{\s*createOpenAiClient\s*\}\s*from\s*['"]@\/lib\/llm\/clients['"]/,
  ) && ok;

  const todayOpenAi = readSource('src/lib/today/openai.ts');
  ok = checkContains(
    'today OpenAI calls use common no-store caller',
    todayOpenAi,
    /callOpenAi[\s\S]*timeoutMs:\s*TODAY_LLM_TIMEOUT_MS/,
  ) && ok;
  ok = runModelAccessCheck(env) && ok;

  console.log('');
  console.log('Manual OpenAI checks still required:');
  console.log('- Production OpenAI organization/project has the required ZDR contract/status.');
  console.log('- Vercel Production and Preview environments contain OPENAI_API_KEY and OPENAI_PROJECT_ID.');
  console.log('- Model access for GPT-5 and GPT-5 mini is verified with the production project when env is configured.');

  if (!ok) {
    console.error('\nOpenAI readiness FAIL');
    process.exit(1);
  }

  console.log('\nOpenAI readiness PASS');
}

main();
