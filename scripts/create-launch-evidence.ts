import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export interface LaunchGateResult {
  name: string;
  required: boolean;
  status: 'pass' | 'fail';
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
  timeoutMs: number;
  command: string;
}

export interface LaunchSummary {
  generatedAt: string;
  cwd: string;
  verdict: 'PASS' | 'FAIL';
  requiredFailures: string[];
  results: LaunchGateResult[];
}

export type GoNoGoDecision = '서비스 오픈 가능' | '조건부 가능' | '오픈 보류';

export interface Args {
  summaryJson: string;
  out: string;
  environment: string;
  domain: string;
  vercelProject: string;
  deploymentUrl: string;
  commitSha: string;
  workingTreeStatus: string;
  operator: string;
  goNoGo?: GoNoGoDecision | null;
}

const AUTO_GENERATED_GO_NO_GO_DECISIONS = ['조건부 가능', '오픈 보류'] as const;
const SERVICE_OPEN_MANUAL_ERROR =
  'Cannot auto-generate 서비스 오픈 가능 evidence. Generate Production evidence first, fill dashboard/smoke/payment/monitoring/canary sections, then update the decision and run verify:launch-evidence-readiness.';

function usage(): never {
  console.error([
    'Usage:',
    '  pnpm create:launch-evidence -- --summary-json <path> --out <path> [options]',
    '',
    'Options:',
    '  --environment <Local|Preview|Production>',
    '  --domain <domain>',
    '  --vercel-project <name>',
    '  --deployment-url <url>',
    '  --commit-sha <sha>',
    '  --working-tree-status <clean|dirty|TBD>',
    '  --operator <name>',
    '  --go-no-go <조건부 가능|오픈 보류>',
    '    Note: 서비스 오픈 가능 must be recorded only after manually completing production evidence.',
  ].join('\n'));
  process.exit(1);
}

function readArg(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) usage();
  return value;
}

function getGitSha(): string {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'TBD';
  }
}

function getGitWorkingTreeStatus(): string {
  try {
    const output = execFileSync('git', ['status', '--short'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return output.length > 0 ? 'dirty - uncommitted local changes present' : 'clean';
  } catch {
    return 'TBD';
  }
}

function parseGoNoGoDecision(value: string | null): GoNoGoDecision | null {
  if (!value) return null;
  if ((AUTO_GENERATED_GO_NO_GO_DECISIONS as readonly string[]).includes(value)) {
    return value as GoNoGoDecision;
  }
  if (value === '서비스 오픈 가능') {
    console.error(SERVICE_OPEN_MANUAL_ERROR);
    process.exit(1);
  }

  console.error(`Invalid --go-no-go value: ${value}`);
  console.error(`Allowed values: ${AUTO_GENERATED_GO_NO_GO_DECISIONS.join(', ')}`);
  process.exit(1);
}

function parseArgs(): Args {
  const summaryJson = readArg('--summary-json');
  const out = readArg('--out');

  if (!summaryJson || !out) usage();

  return {
    summaryJson: resolve(process.cwd(), summaryJson),
    out: resolve(process.cwd(), out),
    environment: readArg('--environment') ?? 'TBD',
    domain: readArg('--domain') ?? 'TBD',
    vercelProject: readArg('--vercel-project') ?? 'TBD',
    deploymentUrl: readArg('--deployment-url') ?? 'TBD',
    commitSha: readArg('--commit-sha') ?? getGitSha(),
    workingTreeStatus: readArg('--working-tree-status') ?? getGitWorkingTreeStatus(),
    operator: readArg('--operator') ?? 'TBD',
    goNoGo: parseGoNoGoDecision(readArg('--go-no-go')),
  };
}

function isLaunchSummary(value: unknown): value is LaunchSummary {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<LaunchSummary>;
  return (
    typeof candidate.generatedAt === 'string' &&
    typeof candidate.cwd === 'string' &&
    (candidate.verdict === 'PASS' || candidate.verdict === 'FAIL') &&
    Array.isArray(candidate.requiredFailures) &&
    Array.isArray(candidate.results)
  );
}

function loadSummary(path: string): LaunchSummary {
  if (!existsSync(path)) {
    console.error(`Summary JSON not found: ${path}`);
    process.exit(1);
  }

  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (!isLaunchSummary(parsed)) {
    console.error(`Invalid launch readiness summary JSON: ${path}`);
    process.exit(1);
  }

  return parsed;
}

function formatKst(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    dateStyle: 'short',
    timeStyle: 'medium',
    hour12: false,
  }).format(date);
}

function msToSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function escapeCell(value: string): string {
  return value.replaceAll('|', '\\|').replace(/\r?\n/g, ' ');
}

function gateRows(summary: LaunchSummary): string {
  return summary.results
    .map((result) => {
      const status = result.status.toUpperCase();
      const timeout = result.timedOut ? 'yes' : 'no';
      const evidence = [
        `exit=${result.exitCode ?? 'none'}`,
        `duration=${msToSeconds(result.durationMs)}`,
        `timeout=${msToSeconds(result.timeoutMs)}`,
        `timedOut=${timeout}`,
      ].join(', ');

      return `| ${escapeCell(result.name)} | ${result.required ? 'yes' : 'no'} | ${status} | ${escapeCell(evidence)} |`;
    })
    .join('\n');
}

function requiredFailureRows(summary: LaunchSummary): string {
  if (summary.requiredFailures.length === 0) {
    return '| none | Launch readiness gate passed |';
  }

  return summary.requiredFailures
    .map((name) => `| ${escapeCell(name)} | Must be cleared before production open |`)
    .join('\n');
}

function defaultGoNoGo(summary: LaunchSummary): GoNoGoDecision {
  return summary.verdict === 'PASS' ? '조건부 가능' : '오픈 보류';
}

function resolveGoNoGo(summary: LaunchSummary, args: Args): GoNoGoDecision {
  const decision = args.goNoGo ?? defaultGoNoGo(summary);
  if (summary.verdict === 'FAIL' && decision !== '오픈 보류') {
    throw new Error(`Cannot record ${decision} when launch readiness verdict is FAIL.`);
  }
  if (decision === '서비스 오픈 가능' && args.environment !== 'Production') {
    throw new Error('서비스 오픈 가능 can only be recorded for Production evidence.');
  }
  if (decision === '서비스 오픈 가능') {
    throw new Error(SERVICE_OPEN_MANUAL_ERROR);
  }

  return decision;
}

function decisionReason(summary: LaunchSummary, decision: GoNoGoDecision): string {
  if (decision === '서비스 오픈 가능') {
    return 'Launch readiness, dashboard evidence, production smoke, and live feature payment/unlock/token ledger evidence are marked complete by operator.';
  }
  if (decision === '조건부 가능') {
    return 'Launch readiness gate passed; accepted residual risks and rollback conditions must be recorded before public traffic.';
  }

  return summary.verdict === 'PASS'
    ? 'Operator selected open hold despite passing launch readiness; do not open until the hold reason is resolved.'
    : 'Launch readiness gate failed; required failures must be cleared before production open.';
}

export function renderEvidence(summary: LaunchSummary, args: Args): string {
  const goNoGo = resolveGoNoGo(summary, args);
  return `# Launch Evidence - ${args.environment}

> Generated from a secret-free \`pnpm verify:launch-readiness -- --summary-json\` result. Do not add secret values, raw PII, birth_date, nickname, email, or original gender values to this file.

## Summary

| Field | Value |
|---|---|
| Evidence date/time (KST) | ${formatKst(summary.generatedAt)} |
| Environment | ${escapeCell(args.environment)} |
| Domain | ${escapeCell(args.domain)} |
| Vercel project | ${escapeCell(args.vercelProject)} |
| Deployment URL | ${escapeCell(args.deploymentUrl)} |
| Commit SHA | ${escapeCell(args.commitSha)} |
| Working tree status | ${escapeCell(args.workingTreeStatus)} |
| Supabase project ref | \`jamhkucluhiibqpjsiov\` |
| Launch readiness verdict | ${summary.verdict} |
| Go/No-Go | ${goNoGo} |
| Operator | ${escapeCell(args.operator)} |
| Source summary JSON | ${escapeCell(args.summaryJson)} |

## Launch Gate Results

| Gate | Required | Result | Evidence |
|---|---:|---:|---|
${gateRows(summary)}

## Required Failures

| Gate | Required Action |
|---|---|
${requiredFailureRows(summary)}

## Dashboard Evidence

| Area | Required Evidence | Result |
|---|---|---:|
| Vercel | production domain, env presence, rollback deployment | TBD |
| Supabase migrations | remote latest matches local | TBD |
| Supabase Auth | Site URL and redirect URLs include production domain | TBD |
| Supabase security | protected RPCs not executable by \`anon\`/\`authenticated\` | TBD |
| Toss | live keys active, success/fail URLs, live payment method | TBD |
| OpenAI | ZDR project, \`OPENAI_PROJECT_ID\`, model access | TBD |
| Sentry | server/browser events and payment/LLM/5xx alerts | TBD |

## Production Smoke Notes

Record only non-sensitive IDs and redacted summaries.

| Flow | Result | Evidence |
|---|---:|---|
| signup/login/OAuth callback | TBD | no email values |
| onboarding to today/me | TBD | no birth date values |
| relation create/feed | TBD | no nickname values |
| hapcard create/view | TBD | hapcard id only |
| replay token spend/refund | TBD | ledger reference id only |
| whatif | TBD | result id only |
| paid feature payment success | TBD | toss_order_id/feature_ref only |
| paid fail/cancel | TBD | toss_order_id only |
| paid manual refund/cancel drill | TBD | toss_order_id and owner only |
| OG/share | TBD | URL path only |
| 401/404/500 UX | TBD | status/code only |

## Payment Ledger Evidence

| Event | Non-sensitive Reference | Expected | Actual |
|---|---|---|---|
| payment init | toss_order_id | pending payment row | TBD |
| payment confirm | toss_order_id/feature_ref | confirmed feature unlock, no purchase ledger | TBD |
| duplicate confirm | toss_order_id/feature_ref | idempotent no double unlock | TBD |
| replay spend | replay reference id | negative ledger | TBD |
| replay refund | replay reference id | refund ledger on failure | TBD |
| monetary refund/cancel drill | toss_order_id | Toss dashboard/manual refund status and before/after ledger export recorded | TBD |

## Monitoring

| Signal | Window | Result |
|---|---|---:|
| Sentry 5xx rate | 15 min | TBD |
| Payment confirm failures | 15 min | TBD |
| LLM timeout/rate-limit/outage | 15 min | TBD |
| Supabase DB/Auth errors | 15 min | TBD |
| Vercel function errors | 15 min | TBD |

## Canary Evidence

| Check | Window | Result |
|---|---|---:|
| Production canary start time | first 15 min | TBD |
| Feature payment and unlock canary | first live low-value feature order | TBD |
| Manual refund/cancel operator canary | first live low-value order or approved dry run | TBD |
| Auth/OAuth canary | first production smoke account | TBD |
| LLM fallback/circuit breaker budget canary | first 15 min | TBD |
| Rollback deployment confirmed available | before public traffic | TBD |

## Decision

Final decision: ${goNoGo}

Reason: ${decisionReason(summary, goNoGo)}

Known risks accepted:

Rollback trigger:

Next review time:
`;
}

function main() {
  const args = parseArgs();
  const summary = loadSummary(args.summaryJson);
  try {
    mkdirSync(dirname(args.out), { recursive: true });
    writeFileSync(args.out, renderEvidence(summary, args), 'utf8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to write launch evidence: ${args.out}`);
    console.error(message);
    process.exit(1);
  }
  console.log(`Launch evidence written: ${args.out}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
