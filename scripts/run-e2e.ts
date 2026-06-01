import { execSync, spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const PNPM = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

export interface ParsedArgs {
  baseUrl: string | null;
  playwrightArgs: string[];
}

export function parseArgs(args: string[]): ParsedArgs {
  const playwrightArgs: string[] = [];
  let baseUrl: string | null = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--base-url') {
      const next = args[index + 1];
      if (!next || next.startsWith('--')) {
        throw new Error('--base-url requires an absolute URL');
      }
      baseUrl = next;
      index += 1;
      continue;
    }

    if (arg.startsWith('--base-url=')) {
      const value = arg.slice('--base-url='.length);
      if (!value) throw new Error('--base-url requires an absolute URL');
      baseUrl = value;
      continue;
    }

    playwrightArgs.push(arg);
  }

  return { baseUrl: baseUrl ? normalizeBaseUrl(baseUrl) : null, playwrightArgs };
}

export function normalizeBaseUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error(`--base-url must be an absolute http(s) origin: ${input}`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`--base-url must use http or https: ${input}`);
  }

  if (url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) {
    throw new Error(`--base-url must be an origin without path, query, hash, or credentials: ${input}`);
  }

  return url.origin;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.status < 500 && response.status !== 404) return;
    } catch {
      // Server not ready yet.
    }
    await delay(750);
  }

  throw new Error(`Timed out waiting for ${url}`);
}

function startNextServer(): ChildProcess {
  const args = [
    'node_modules/next/dist/bin/next',
    'dev',
    '--hostname',
    '127.0.0.1',
    '--port',
    String(PORT),
  ];
  return spawn(process.execPath, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });
}

function stopProcessTree(child: ChildProcess): void {
  if (!child.pid) return;

  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
    stopWindowsProcessListeningOnPort(PORT);
    return;
  }

  child.kill('SIGTERM');
}

function stopWindowsProcessListeningOnPort(port: number): void {
  try {
    const output = execSync('netstat -ano', { encoding: 'utf8' });
    const listenLine = output
      .split(/\r?\n/)
      .find((line) => line.includes(`127.0.0.1:${port}`) && line.includes('LISTENING'));
    const pid = listenLine?.trim().split(/\s+/).at(-1);
    if (pid && /^\d+$/.test(pid)) {
      spawnSync('taskkill', ['/pid', pid, '/t', '/f'], { stdio: 'ignore' });
    }
  } catch {
    // Best-effort cleanup only.
  }
}

async function main() {
  const { baseUrl: explicitBaseUrl, playwrightArgs } = parseArgs(process.argv.slice(2));
  const baseUrl = explicitBaseUrl
    ?? (process.env.PLAYWRIGHT_BASE_URL ? normalizeBaseUrl(process.env.PLAYWRIGHT_BASE_URL) : null)
    ?? `http://127.0.0.1:${PORT}`;
  const runAuthE2e =
    process.env.RUN_AUTH_E2E === '1' ||
    playwrightArgs.some((arg) => arg.includes('@auth') || arg.includes('auth-smoke'));
  const playwrightEnv = {
    ...process.env,
    ...(runAuthE2e ? { RUN_AUTH_E2E: '1' } : {}),
  };

  if (explicitBaseUrl || process.env.PLAYWRIGHT_BASE_URL) {
    const result = spawnSync(PNPM, ['exec', 'playwright', 'test', ...playwrightArgs], {
      cwd: process.cwd(),
      env: { ...playwrightEnv, PLAYWRIGHT_BASE_URL: baseUrl },
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    process.exit(result.status ?? 1);
  }

  const server = startNextServer();
  let exitCode = 1;
  try {
    await waitForServer(new URL('/signup', baseUrl).toString(), 120_000);

    const result = spawnSync(PNPM, ['exec', 'playwright', 'test', ...playwrightArgs], {
      cwd: process.cwd(),
      env: { ...playwrightEnv, PLAYWRIGHT_BASE_URL: baseUrl },
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    exitCode = result.status ?? 1;
  } finally {
    stopProcessTree(server);
  }
  process.exit(exitCode);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
