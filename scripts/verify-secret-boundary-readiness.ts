import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

const SERVER_ONLY_ENV_KEYS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'OPENAI_API_KEY',
  'OPENAI_PROJECT_ID',
  'ANTHROPIC_API_KEY',
  'KASI_SERVICE_KEY',
  'TOSS_SECRET_KEY',
  'TOSS_PAYMENTS_SECRET_KEY',
  'KAKAO_ADMIN_KEY',
  'SENTRY_DSN',
];

const NEXT_PUBLIC_ALLOWLIST = new Set([
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY',
  'NEXT_PUBLIC_SENTRY_DSN',
  'NEXT_PUBLIC_TODAY_WITH_RELATION',
  'NEXT_PUBLIC_VERCEL_ENV',
]);

interface SourceFile {
  path: string;
  absolutePath: string;
  source: string;
}

interface BoundaryViolation {
  root: string;
  file: string;
  key: string;
}

function toPosix(path: string): string {
  return path.replace(/\\/g, '/');
}

function listSourceFiles(dir: string): SourceFile[] {
  const root = resolve(process.cwd(), dir);
  const files: SourceFile[] = [];

  function walk(current: string): void {
    for (const entry of readdirSync(current)) {
      const absolutePath = join(current, entry);
      const stat = statSync(absolutePath);
      if (stat.isDirectory()) {
        walk(absolutePath);
        continue;
      }

      if (!SOURCE_EXTENSIONS.some((extension) => absolutePath.endsWith(extension))) continue;
      files.push({
        path: toPosix(relative(process.cwd(), absolutePath)),
        absolutePath,
        source: readFileSync(absolutePath, 'utf8'),
      });
    }
  }

  walk(root);
  return files;
}

function hasUseClientDirective(source: string): boolean {
  const firstMeaningfulLine = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith('//'));
  return firstMeaningfulLine === "'use client';"
    || firstMeaningfulLine === '"use client";'
    || firstMeaningfulLine === "'use client'"
    || firstMeaningfulLine === '"use client"';
}

function isClientRoot(file: SourceFile): boolean {
  return file.path === 'src/instrumentation-client.ts' || hasUseClientDirective(file.source);
}

function parseEnvExampleKeys(): string[] {
  const envExamplePath = resolve(process.cwd(), '.env.example');
  if (!existsSync(envExamplePath)) return [];

  return readFileSync(envExamplePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => line.slice(0, line.indexOf('=')).trim());
}

function envReferencePattern(key: string): RegExp {
  return new RegExp(`process\\.env(?:\\.${key}|\\[['"\`]${key}['"\`]\\])`);
}

function hasServerOnlyEnvReference(source: string, key: string): boolean {
  if (envReferencePattern(key).test(source)) return true;
  return source.includes(key) && /process\.env\s*\[/.test(source);
}

function parseRuntimeImports(source: string): string[] {
  const imports: string[] = [];
  const importPattern = /\b(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g;

  for (const match of source.matchAll(importPattern)) {
    const statement = match[0];
    if (/^import\s+type\b/.test(statement) || /^export\s+type\b/.test(statement)) continue;
    imports.push(match[1]);
  }

  return imports;
}

function resolveImport(fromFile: SourceFile, specifier: string, filesByPath: Map<string, SourceFile>): SourceFile | null {
  if (specifier.startsWith('@/')) {
    return resolveSourcePath(`src/${specifier.slice(2)}`, filesByPath);
  }

  if (specifier.startsWith('.')) {
    const fromDir = toPosix(dirname(fromFile.path));
    return resolveSourcePath(toPosix(join(fromDir, specifier)), filesByPath);
  }

  return null;
}

function resolveSourcePath(basePath: string, filesByPath: Map<string, SourceFile>): SourceFile | null {
  const normalized = toPosix(basePath);
  if (filesByPath.has(normalized)) return filesByPath.get(normalized) ?? null;

  for (const extension of SOURCE_EXTENSIONS) {
    const direct = `${normalized}${extension}`;
    if (filesByPath.has(direct)) return filesByPath.get(direct) ?? null;
  }

  for (const extension of SOURCE_EXTENSIONS) {
    const index = `${normalized}/index${extension}`;
    if (filesByPath.has(index)) return filesByPath.get(index) ?? null;
  }

  return null;
}

function collectReachableClientFiles(root: SourceFile, filesByPath: Map<string, SourceFile>): Map<string, SourceFile> {
  const reachable = new Map<string, SourceFile>();
  const stack = [root];

  while (stack.length > 0) {
    const file = stack.pop();
    if (!file || reachable.has(file.path)) continue;
    reachable.set(file.path, file);

    for (const specifier of parseRuntimeImports(file.source)) {
      const imported = resolveImport(file, specifier, filesByPath);
      if (imported && !reachable.has(imported.path)) stack.push(imported);
    }
  }

  return reachable;
}

function checkPublicEnvNames(): boolean {
  let ok = true;
  const envKeys = parseEnvExampleKeys();

  console.log('Public env naming checks:');
  for (const key of envKeys.filter((candidate) => candidate.startsWith('NEXT_PUBLIC_'))) {
    const allowed = NEXT_PUBLIC_ALLOWLIST.has(key);
    console.log(`[public env] ${allowed ? 'OK' : 'FAIL'} ${key}`);
    ok = allowed && ok;
  }

  return ok;
}

function checkClientGraph(files: SourceFile[]): boolean {
  const filesByPath = new Map(files.map((file) => [file.path, file]));
  const clientRoots = files.filter(isClientRoot);
  const violations: BoundaryViolation[] = [];
  const clientReachable = new Set<string>();

  for (const root of clientRoots) {
    const reachable = collectReachableClientFiles(root, filesByPath);
    for (const [path, file] of reachable) {
      clientReachable.add(path);
      for (const key of SERVER_ONLY_ENV_KEYS) {
        if (hasServerOnlyEnvReference(file.source, key)) {
          violations.push({ root: root.path, file: path, key });
        }
      }
    }
  }

  console.log('');
  console.log('Client bundle secret boundary checks:');
  console.log(`[client graph] OK ${clientRoots.length} client root(s), ${clientReachable.size} reachable source file(s) scanned`);

  if (violations.length === 0) {
    console.log('[client graph] OK no server-only env references reachable from client roots');
    return true;
  }

  for (const violation of violations) {
    console.log(`[client graph] FAIL ${violation.key} reachable from ${violation.root} via ${violation.file}`);
  }
  return false;
}

function main() {
  console.log('Secret/public env boundary readiness check');
  console.log('This check verifies server-only launch secrets are not reachable from Client Component import graphs.');
  console.log('');

  const files = listSourceFiles('src');
  const ok = checkPublicEnvNames() && checkClientGraph(files);

  if (!ok) {
    console.error('\nSecret/public env boundary readiness FAIL');
    process.exit(1);
  }

  console.log('\nSecret/public env boundary readiness PASS');
}

main();
