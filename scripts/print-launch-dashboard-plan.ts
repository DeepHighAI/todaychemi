import { pathToFileURL } from 'node:url';

import { isProductionOrigin } from './verify-launch-env';

const SUPABASE_CALLBACK = 'https://jamhkucluhiibqpjsiov.supabase.co/auth/v1/callback';

function readArg(name: string): string | null {
  const withEquals = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (withEquals) return withEquals.slice(name.length + 1);

  const index = process.argv.indexOf(name);
  if (index < 0) return null;
  const value = process.argv[index + 1];
  return value && !value.startsWith('--') ? value : null;
}

function printDerivedUrls(origin: string) {
  console.log('확정된 public URL 입력값:');
  console.log(`- NEXT_PUBLIC_APP_URL: ${origin}`);
  console.log(`- Supabase Site URL: ${origin}`);
  console.log(`- Supabase Redirect URL: ${origin}/auth/callback`);
  console.log(`- Google/Kakao Web origin: ${origin}`);
  console.log(`- Google/Kakao OAuth callback: ${SUPABASE_CALLBACK}`);
  console.log(`- Toss Success URL: ${origin}/api/payments/feature/confirm`);
  console.log(`- Toss Fail/Cancel URL: ${origin}/payments/fail`);
}

function printChecklistEvidenceExamples(origin: string) {
  const hostname = new URL(origin).hostname;
  const projectName = hostname.endsWith('.vercel.app')
    ? hostname.replace(/\.vercel\.app$/, '')
    : '<project-name>';

  console.log('');
  console.log('체크리스트 Evidence 예시:');
  console.log(`- Production Origin: project=${projectName}, origin=${origin}, branch=main`);
  console.log(`- Supabase Auth: site_url=${origin}, redirect=/auth/callback, providers=google+kakao`);
  console.log(`- Google/Kakao: origin=${origin}, callback=${SUPABASE_CALLBACK}`);
  console.log('- OpenAI/ZDR: project=<OpenAI project name>, id_prefix=proj_, zdr=confirmed');
  console.log('- Toss: keys=live_gck/live_gsk present, success=/api/payments/feature/confirm, fail=/payments/fail');
  console.log('- Sentry/Ops: alerts=payment-confirm-failure,llm-provider-outage,5xx-spike; owner=<name>');
  console.log('- Custom domain: custom_domain=not_purchased_for_mvp, trigger=after_market_validation, owner=<name>');
}

function main() {
  const origin = readArg('--origin')?.trim() ?? '';

  console.log('Launch dashboard setup plan');
  console.log('목적: Vercel 기본 Production URL로 MVP를 열기 위한 외부 대시보드 작업 순서.');
  console.log('주의: 실제 secret/key/DSN/JWT/email/birth_date/nickname/gender 원본은 출력하거나 문서에 적지 않는다.');

  if (origin) {
    console.log('');
    if (!isProductionOrigin(origin)) {
      console.log(`[origin] FAIL ${origin}`);
      console.log('먼저 pnpm verify:origin-shape-readiness -- --origin https://<project>.vercel.app 로 origin을 고친다.');
      process.exit(1);
    }
    console.log(`[origin] OK ${origin}`);
    printDerivedUrls(origin);
    printChecklistEvidenceExamples(origin);
  } else {
    console.log('');
    console.log('[origin] TBD: Vercel Production *.vercel.app origin을 먼저 확정한다.');
    console.log('예: pnpm print:launch-dashboard-plan -- --origin https://<project>.vercel.app');
  }

  console.log('');
  console.log('1. Vercel');
  console.log('- SAJU/TWODAY 전용 project를 만들거나 올바른 repo에 link한다.');
  console.log('- pnpm print:vercel-env-plan 으로 Production/Preview env key 목록을 확인한다.');
  console.log('- legacy TOSS_PAYMENTS_CLIENT_KEY / TOSS_PAYMENTS_SECRET_KEY 는 launch 기준 비워둔다.');
  console.log('- env 저장 후 Production과 Preview를 redeploy한다.');

  console.log('');
  console.log('2. Supabase Auth');
  console.log('- project_ref는 jamhkucluhiibqpjsiov 인지 확인한다.');
  console.log('- Site URL과 Redirect URL은 위 public URL 입력값을 사용한다.');
  console.log('- Google/Kakao provider를 켜고 email/password 정책과 leaked password protection을 확인한다.');

  console.log('');
  console.log('3. Google / Kakao');
  console.log('- Web origin은 NEXT_PUBLIC_APP_URL origin과 같게 둔다.');
  console.log(`- OAuth callback은 ${SUPABASE_CALLBACK} 을 사용한다.`);
  console.log('- Kakao JavaScript key/Admin key는 Vercel env 존재 여부만 evidence에 기록한다.');

  console.log('');
  console.log('4. OpenAI / Anthropic');
  console.log('- ZDR가 확인된 OpenAI project를 고르고 OPENAI_API_KEY/OPENAI_PROJECT_ID가 같은 project인지 확인한다.');
  console.log('- evidence에는 project name과 id_prefix=proj_ 만 적는다.');
  console.log('- Anthropic fallback key와 LLM_DAILY_BUDGET_USD를 Vercel env에 넣는다.');
  console.log('- env 설정 후 pnpm verify:openai-readiness 로 GPT-5/GPT-5 mini access를 확인한다.');

  console.log('');
  console.log('5. Toss Payments');
  console.log('- live_gck_ / live_gsk_ key만 Vercel env에 넣는다.');
  console.log('- Success/Fail URL은 위 Toss URL을 사용한다.');
  console.log('- live 저액 결제, 중복 confirm, fail/cancel, 수동 환불/취소 owner evidence를 기록한다.');

  console.log('');
  console.log('6. Sentry / Operations');
  console.log('- SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN을 Vercel env에 넣고 default PII 수집이 꺼져 있는지 확인한다.');
  console.log('- payment-confirm-failure, llm-provider-outage, 5xx-spike alert를 만든다.');
  console.log('- rollback owner와 trigger를 checklist/evidence에 적는다.');

  console.log('');
  console.log('7. 검증 순서');
  console.log('- 주의: Vercel dashboard env는 로컬 터미널에 자동 주입되지 않는다.');
  console.log('- pnpm verify:launch-readiness 는 production-equivalent env가 로드된 로컬 shell, CI, 또는 검증 환경에서 실행한다.');
  console.log('- command 결과만 evidence에 기록하고 secret 값은 기록하지 않는다.');
  console.log('- pnpm verify:origin-shape-readiness -- --origin https://<project>.vercel.app');
  console.log('- pnpm verify:external-settings-readiness');
  console.log('- pnpm verify:external-settings-checklist');
  console.log('- pnpm verify:launch-readiness -- --summary-json docs/qa/launch_gate_2026-06-01_production.json');
  console.log('- pnpm create:launch-evidence -- --summary-json docs/qa/launch_gate_2026-06-01_production.json --out docs/qa/launch_evidence_2026-06-01_production.md --environment Production --go-no-go "조건부 가능"');
  console.log('- pnpm verify:launch-evidence-readiness docs/qa/launch_gate_2026-06-01_production.json docs/qa/launch_evidence_2026-06-01_production.md docs/qa/external_settings_checklist.md');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
