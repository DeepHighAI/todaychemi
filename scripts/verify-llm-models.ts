import OpenAI from 'openai';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadDotEnvLocal() {
  const envPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadDotEnvLocal();

const apiKey = process.env.OPENAI_API_KEY;
const project = process.env.OPENAI_PROJECT_ID;
if (!apiKey) {
  console.error('Missing OPENAI_API_KEY in .env.local');
  process.exit(1);
}

const openai = new OpenAI({ apiKey, project });

const TARGET_MODELS = ['gpt-5', 'gpt-5-mini'] as const;
type TargetModel = (typeof TARGET_MODELS)[number];

async function main() {
  // step 1 — 이 API 키로 조회 가능한 gpt-5* / gpt-4o* 모델 목록
  console.log('\n=== Step 1: models.list() — gpt-5* / gpt-4o* ===');
  const page = await openai.models.list();
  const relevant = page.data.filter(
    (m) => m.id.startsWith('gpt-5') || m.id.startsWith('gpt-4o'),
  );
  if (relevant.length === 0) {
    console.log('  (이 API 키로 접근 가능한 gpt-5* / gpt-4o* 모델 없음)');
  } else {
    for (const m of relevant.sort((a, b) => a.id.localeCompare(b.id))) {
      console.log(`  ${m.id}  (owned_by=${m.owned_by})`);
    }
  }

  // step 2 — 타겟 모델별 retrieve
  console.log('\n=== Step 2: models.retrieve() ===');
  const retrieveResults: Record<TargetModel, 'ok' | 'not_found' | 'error'> = {
    'gpt-5': 'error',
    'gpt-5-mini': 'error',
  };
  for (const id of TARGET_MODELS) {
    try {
      const m = await openai.models.retrieve(id);
      const created = new Date(m.created * 1000).toISOString().slice(0, 10);
      console.log(`  ✅ ${id}  OK  (owned_by=${m.owned_by}, created=${created})`);
      retrieveResults[id] = 'ok';
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 404) {
        console.log(`  ❌ ${id}  NOT FOUND`);
        retrieveResults[id] = 'not_found';
      } else {
        console.log(`  ⚠️  ${id}  ERROR: ${(err as Error).message}`);
        retrieveResults[id] = 'error';
      }
    }
  }

  // 요약
  console.log('\n=== 요약 ===');
  for (const id of TARGET_MODELS) {
    const r = retrieveResults[id];
    const icon = r === 'ok' ? '✅' : r === 'not_found' ? '❌' : '⚠️';
    console.log(`  ${icon} ${id}: ${r}`);
  }

  const allOk = TARGET_MODELS.every((id) => retrieveResults[id] === 'ok');
  const notFound = TARGET_MODELS.filter((id) => retrieveResults[id] === 'not_found');

  console.log('');
  if (allOk) {
    console.log('권장 다음 단계: Phase B (buildHapcard E2E) 진행 가능');
  } else if (notFound.length > 0) {
    console.log(`모델 ID 불일치 — NOT FOUND: ${notFound.join(', ')}`);
    console.log('→ Step 1 출력에서 실제 gpt-5* ID를 확인 후 §1.1 결정 필요');
    console.log('  옵션 A: 코드 모델 ID를 실제 ID로 수정 + migration ALTER');
    console.log('  옵션 B: gpt-4o로 복구 + DB CHECK 제약 ALTER');
  } else {
    console.log('→ ERROR 발생 모델 있음 — API 키 권한 또는 네트워크 확인 필요');
  }
}

main().catch((e) => {
  console.error('verify failed:', e);
  process.exit(1);
});
