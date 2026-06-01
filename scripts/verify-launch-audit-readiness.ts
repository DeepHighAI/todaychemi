import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

interface TextCheck {
  file: string;
  label: string;
  pattern: RegExp;
}

interface PackageScriptCheck {
  name: string;
  includes: string;
}

export interface Finding {
  file: string;
  label: string;
}

const TEXT_CHECKS: TextCheck[] = [
  {
    file: 'docs/qa/launch_readiness_2026-05-30.md',
    label: 'Launch Readiness Audit document exists with dated title',
    pattern: /^# Launch Readiness Audit - 2026-05-30/m,
  },
  {
    file: 'docs/qa/launch_readiness_2026-05-30.md',
    label: 'Go/No-Go decision is recorded as open hold',
    pattern: /## 판정[\s\S]*\*\*오픈 보류\.\*\*/,
  },
  {
    file: 'docs/qa/launch_readiness_2026-05-30.md',
    label: 'Implementation summary and changed files are recorded',
    pattern: /## Implementation Summary and Changed Files[\s\S]*Primary files[\s\S]*src\/lib\/llm\/clients\.ts[\s\S]*scripts\/verify-launch-readiness\.ts/,
  },
  {
    file: 'docs/qa/launch_readiness_2026-05-30.md',
    label: 'Validation command/results table is recorded',
    pattern: /## Validation Run[\s\S]*`pnpm tsc --noEmit`[\s\S]*`pnpm lint`[\s\S]*`pnpm vitest run`[\s\S]*`pnpm build`/,
  },
  {
    file: 'docs/qa/launch_readiness_2026-05-30.md',
    label: 'Supabase, E2E, and launch gate evidence is recorded',
    pattern: /`pnpm db:push:dry`[\s\S]*`pnpm e2e`[\s\S]*`pnpm e2e:auth`[\s\S]*`pnpm verify:launch-readiness`/,
  },
  {
    file: 'docs/qa/launch_readiness_2026-05-30.md',
    label: 'P0/P1/P2 launch backlog sections are recorded',
    pattern: /## P0 Backlog[\s\S]*## P1 Backlog[\s\S]*## P2 Backlog/,
  },
  {
    file: 'docs/qa/launch_readiness_2026-05-30.md',
    label: 'Approval decisions and manual launch tasks are recorded',
    pattern: /## Approval Questions[\s\S]*## Manual Launch Tasks/,
  },
  {
    file: 'docs/qa/launch_readiness_2026-05-30.md',
    label: 'Pre-open checklist and rollback procedure are recorded',
    pattern: /## Pre-Open Checklist[\s\S]*## Rollback Procedure/,
  },
  {
    file: 'docs/qa/launch_readiness_2026-05-30.md',
    label: 'Remaining required failures are explicit',
    pattern: /Required failures remain exactly:(?=[\s\S]*launch env)(?=[\s\S]*Auth readiness)(?=[\s\S]*OpenAI\/ZDR readiness)(?=[\s\S]*Toss live readiness)(?=[\s\S]*Vercel readiness)(?=[\s\S]*Operations\/E2E readiness)(?=[\s\S]*External settings checklist readiness)/,
  },
  {
    file: 'docs/qa/launch_readiness_2026-05-30.md',
    label: 'Known external blocker helper is recorded',
    pattern: /pnpm verify:known-external-blockers[\s\S]*known external dashboard\/env\/checklist evidence work[\s\S]*does not change Go\/No-Go/,
  },
  {
    file: 'docs/qa/launch_readiness_2026-05-30.md',
    label: 'Launch waiting-state helper is recorded',
    pattern: /pnpm verify:launch-waiting-state[\s\S]*external-settings waiting state[\s\S]*does not replace the full launch readiness gate/,
  },
  {
    file: 'docs/qa/launch_p0_approval_packet.md',
    label: 'P0 approval packet covers D1-D8 decisions',
    pattern: /D1 Supabase payment migration[\s\S]*D8 Dependency advisory remediation/,
  },
  {
    file: 'docs/runbooks/external_launch_settings.md',
    label: 'External settings guide covers dashboards and env',
    pattern: /## OpenAI[\s\S]*OPENAI_PROJECT_ID[\s\S]*## Vercel[\s\S]*NEXT_PUBLIC_APP_URL[\s\S]*## Supabase Auth[\s\S]*## Toss Payments[\s\S]*## Sentry \/ Operations[\s\S]*pnpm verify:external-settings-readiness/,
  },
  {
    file: 'docs/runbooks/external_launch_settings.md',
    label: 'External settings guide records the no-custom-domain MVP origin policy',
    pattern: /## MVP 도메인 원칙(?=[\s\S]*Vercel 기본 Production URL)(?=[\s\S]*\*\.vercel\.app)(?=[\s\S]*Preview URL)(?=[\s\S]*NEXT_PUBLIC_APP_URL)(?=[\s\S]*자체 도메인)/,
  },
  {
    file: 'docs/specs/secrets.md',
    label: 'Secrets catalog records the no-custom-domain MVP Vercel env flow',
    pattern:
      /^(?![\s\S]*(?:today\.example\.com|npx vercel env add|npx vercel --force))[\s\S]*## 3\. Vercel 환경 등록[\s\S]*MVP는 아직 커스텀 도메인[\s\S]*https:\/\/<project>\.vercel\.app[\s\S]*pnpm print:vercel-env-plan[\s\S]*pnpm verify:origin-shape-readiness[\s\S]*pnpm print:launch-dashboard-plan/,
  },
  {
    file: 'docs/runbooks/google_oauth.md',
    label: 'Google OAuth runbook covers MVP production origin and Supabase callback setup',
    pattern: /NEXT_PUBLIC_APP_URL[\s\S]*https:\/\/<vercel-production-url>[\s\S]*https:\/\/jamhkucluhiibqpjsiov\.supabase\.co\/auth\/v1\/callback[\s\S]*external_settings_checklist\.md/,
  },
  {
    file: 'docs/runbooks/kakao_oauth_share.md',
    label: 'Kakao OAuth/share runbook covers MVP production origin and secret-free evidence',
    pattern: /NEXT_PUBLIC_APP_URL[\s\S]*https:\/\/<vercel-production-url>[\s\S]*https:\/\/<vercel-production-url>\/api\/share\/kakao\/callback[\s\S]*external_settings_checklist\.md/,
  },
  {
    file: 'docs/runbooks/launch_opening.md',
    label: 'Launch opening runbook covers smoke, Go/No-Go, and rollback',
    pattern: /## 3\. Production 배포 직전 수동 확인[\s\S]*monetary refund\/cancel automation is not part of MVP[\s\S]*## 4\. Production smoke[\s\S]*Toss 금전 환불\/취소[\s\S]*## 5\. 오픈 판정[\s\S]*서비스 오픈 가능[\s\S]*조건부 가능[\s\S]*오픈 보류[\s\S]*## 6\. 즉시 롤백/,
  },
  {
    file: 'scripts/run-e2e.ts',
    label: 'E2E runner supports shell-neutral deployed URL smoke',
    pattern: /normalizeBaseUrl[\s\S]*--base-url[\s\S]*origin without path, query, hash, or credentials[\s\S]*PLAYWRIGHT_BASE_URL: baseUrl[\s\S]*playwrightArgs/,
  },
  {
    file: 'docs/qa/launch_evidence_template.md',
    label: 'Launch evidence template covers dashboard, smoke, ledger, monitoring, canary, and decision evidence',
    pattern: /verify:launch-evidence-readiness <json> <md> docs\/qa\/external_settings_checklist\.md[\s\S]*## Dashboard Evidence[\s\S]*## Production Smoke Notes[\s\S]*paid manual refund\/cancel drill[\s\S]*## Payment Ledger Evidence[\s\S]*monetary refund\/cancel drill[\s\S]*## Monitoring[\s\S]*## Canary Evidence[\s\S]*Manual refund\/cancel operator canary[\s\S]*## Decision/,
  },
  {
    file: 'docs/qa/external_settings_checklist.md',
    label: 'External settings checklist covers secret-free dashboard readiness evidence',
    pattern: /## Production Origin[\s\S]*## Vercel Environment Variables[\s\S]*## Supabase Auth[\s\S]*## OpenAI \/ ZDR[\s\S]*## Toss Payments[\s\S]*## Sentry \/ Operations[\s\S]*pnpm verify:external-settings-readiness/,
  },
  {
    file: 'scripts/verify-external-settings-checklist.ts',
    label: 'External settings checklist verifier exists',
    pattern: /isExternalSettingsChecklistPlaceholderEvidence[\s\S]*scanStatusCells[\s\S]*external settings checklist still contains TBD placeholders[\s\S]*scanExternalSettingsChecklist[\s\S]*scanLaunchEvidence[\s\S]*External settings checklist readiness PASS/,
  },
  {
    file: 'tests/scripts/verify-external-settings-checklist.test.ts',
    label: 'External settings checklist tests lock placeholder catalog sync across verifiers',
    pattern: /collectCurrentTemplateEvidenceCells[\s\S]*keeps the current checklist template placeholder evidence catalog in sync across launch verifiers[\s\S]*isExternalSettingsChecklistPlaceholderEvidence[\s\S]*isLaunchExternalChecklistPlaceholderCell/,
  },
  {
    file: 'scripts/README.md',
    label: 'Scripts README records external settings readiness as env plus checklist evidence',
    pattern: /verify-external-settings-readiness\.ts[\s\S]*Vercel\/Supabase Auth\/OpenAI\/Toss\/Sentry[\s\S]*operator checklist evidence[\s\S]*pnpm verify:external-settings-readiness/,
  },
  {
    file: 'scripts/README.md',
    label: 'Scripts README records origin shape verifier for dashboard URL setup',
    pattern: /verify-origin-shape-readiness\.ts[\s\S]*Supabase\/Auth\/OAuth\/Toss dashboard[\s\S]*pnpm verify:origin-shape-readiness/,
  },
  {
    file: 'scripts/README.md',
    label: 'Scripts README records Vercel env setup plan printer',
    pattern: /print-vercel-env-plan\.ts[\s\S]*Vercel Production\/Preview[\s\S]*legacy alias[\s\S]*pnpm print:vercel-env-plan/,
  },
  {
    file: 'scripts/README.md',
    label: 'Scripts README records launch dashboard setup plan printer',
    pattern: /print-launch-dashboard-plan\.ts[\s\S]*Vercel\/Supabase Auth\/Google\/Kakao\/OpenAI\/Anthropic\/Toss\/Sentry[\s\S]*pnpm print:launch-dashboard-plan/,
  },
  {
    file: 'scripts/verify-external-settings-readiness.ts',
    label: 'External settings preflight points operators to the Korean guide and evidence files',
    pattern: /docs\/runbooks\/external_launch_settings\.md[\s\S]*docs\/qa\/external_settings_checklist\.md[\s\S]*docs\/qa\/launch_evidence_template\.md/,
  },
];

const PACKAGE_SCRIPT_CHECKS: PackageScriptCheck[] = [
  { name: 'verify:launch-readiness', includes: 'verify-launch-readiness.ts' },
  { name: 'verify:launch-waiting-state', includes: 'verify-launch-waiting-state.ts' },
  { name: 'verify:known-external-blockers', includes: 'verify-known-external-blockers.ts' },
  { name: 'verify:external-settings-readiness', includes: 'verify-external-settings-readiness.ts' },
  { name: 'verify:external-settings-checklist', includes: 'verify-external-settings-checklist.ts' },
  { name: 'verify:origin-shape-readiness', includes: 'verify-origin-shape-readiness.ts' },
  { name: 'print:vercel-env-plan', includes: 'print-vercel-env-plan.ts' },
  { name: 'print:launch-dashboard-plan', includes: 'print-launch-dashboard-plan.ts' },
  { name: 'verify:launch-env', includes: 'verify-launch-env.ts' },
  { name: 'verify:payment-flow-readiness', includes: 'verify-payment-flow-readiness.ts' },
  { name: 'verify:llm-resilience-readiness', includes: 'verify-llm-resilience-readiness.ts' },
  { name: 'verify:e2e-coverage-readiness', includes: 'verify-e2e-coverage-readiness.ts' },
  { name: 'verify:launch-evidence-readiness', includes: 'verify-launch-evidence-readiness.ts' },
  { name: 'create:launch-evidence', includes: 'create-launch-evidence.ts' },
  { name: 'e2e', includes: 'run-e2e.ts' },
  { name: 'e2e:auth', includes: '@auth' },
];

function readFile(root: string, file: string): string | null {
  const path = resolve(root, file);
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf8');
}

export function scanLaunchAuditArtifacts(root = process.cwd()): Finding[] {
  const findings: Finding[] = [];

  for (const check of TEXT_CHECKS) {
    const source = readFile(root, check.file);
    if (!source) {
      findings.push({ file: check.file, label: 'missing required launch artifact' });
      continue;
    }
    if (!check.pattern.test(source)) {
      findings.push({ file: check.file, label: check.label });
    }
  }

  const packageSource = readFile(root, 'package.json');
  if (!packageSource) {
    findings.push({ file: 'package.json', label: 'missing package.json' });
    return findings;
  }

  let packageJson: { scripts?: Record<string, string> };
  try {
    packageJson = JSON.parse(packageSource) as { scripts?: Record<string, string> };
  } catch {
    findings.push({ file: 'package.json', label: 'invalid package.json' });
    return findings;
  }

  for (const check of PACKAGE_SCRIPT_CHECKS) {
    const script = packageJson.scripts?.[check.name];
    if (!script || !script.includes(check.includes)) {
      findings.push({
        file: 'package.json',
        label: `missing or invalid script ${check.name}`,
      });
    }
  }

  return findings;
}

function main() {
  console.log('Launch audit artifact readiness check');
  console.log('Scope: final audit, backlog, approval, manual-settings, evidence, and runbook artifacts.');

  const findings = scanLaunchAuditArtifacts();
  if (findings.length > 0) {
    console.log('');
    console.log('Findings:');
    for (const finding of findings) {
      console.log(`- ${finding.file} - ${finding.label}`);
    }
    console.error('\nLaunch audit artifact readiness FAIL');
    process.exit(1);
  }

  console.log('');
  console.log('[artifact] OK launch audit deliverables');
  console.log('[artifact] OK package readiness scripts');
  console.log('\nLaunch audit artifact readiness PASS');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
