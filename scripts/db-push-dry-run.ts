import { spawnSync } from 'node:child_process';

const PNPM = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const PENDING_MIGRATIONS_PATTERN = /Would push these migrations:\s*\n\s*•/;

const result = spawnSync(PNPM, ['dlx', 'supabase', 'db', 'push', '--dry-run', '--linked'], {
  cwd: process.cwd(),
  encoding: 'utf8',
  shell: process.platform === 'win32',
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

const combinedOutput = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

if (PENDING_MIGRATIONS_PATTERN.test(combinedOutput)) {
  console.error('\nSupabase migration dry-run FAIL: remote database is not up to date.');
  console.error('Apply the listed migrations only after the approved DB change window.');
  process.exit(1);
}

console.log('\nSupabase migration dry-run PASS: remote database is up to date.');
