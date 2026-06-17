// scripts/mint-dev-bearer.ts
//
// 로컬 미니앱 테스트용 Supabase access_token(JWT) 발급.
// 테스트 계정(기본 Test1@test.com)으로 로그인해 토큰을 발급한다.
// 이 토큰을 miniapp/.env.local 의 VITE_DEV_BEARER 에 넣으면, 미니앱이
// Toss appLogin() 없이 인증된 상태로 로컬 백엔드 API 를 호출할 수 있다.
//
// 사용:
//   pnpm mint:dev-bearer            → 토큰을 stdout 에 출력
//   pnpm mint:dev-bearer --write    → miniapp/.env.local 의 VITE_DEV_BEARER 자동 갱신(토큰 미노출)
//
// 토큰은 약 1시간 후 만료된다. 만료되면 다시 실행한다.
// 사전 조건: `pnpm seed:test-user` 로 테스트 계정이 생성돼 있어야 한다.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { createClient } from '@supabase/supabase-js';

const TEST_EMAIL = process.env.TEST_EMAIL ?? 'Test1@test.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? 'test1234';

// 다른 시드 스크립트와 동일한 .env.local 로더(시크릿은 출력하지 않는다).
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

// miniapp/.env.local 의 VITE_DEV_BEARER 한 줄만 갱신(나머지 라인 보존).
function writeBearerToMiniappEnv(token: string) {
  const envPath = resolve(process.cwd(), 'miniapp', '.env.local');
  const line = `VITE_DEV_BEARER=${token}`;
  let content = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : '';
  if (/^VITE_DEV_BEARER=.*$/m.test(content)) {
    content = content.replace(/^VITE_DEV_BEARER=.*$/m, line);
  } else {
    content = `${content.replace(/\s*$/, '')}\n${line}\n`;
  }
  writeFileSync(envPath, content, 'utf-8');
  console.error('✓ miniapp/.env.local 의 VITE_DEV_BEARER 갱신 완료.');
}

async function main() {
  loadDotEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('필수 환경변수 누락: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (.env.local)');
  }

  const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  if (error || !data.session) {
    throw new Error(
      `로그인 실패(${TEST_EMAIL}): ${error?.message ?? 'no session'} — 먼저 'pnpm seed:test-user' 를 실행하세요.`,
    );
  }

  const token = data.session.access_token;
  const expIso = new Date((data.session.expires_at ?? 0) * 1000).toISOString();

  if (process.argv.includes('--write')) {
    writeBearerToMiniappEnv(token);
  } else {
    // 기본: 토큰만 stdout 으로(파이프/복사용). 부가정보는 stderr.
    console.log(token);
  }
  console.error(`사용자: ${TEST_EMAIL} · 토큰 만료(UTC): ${expIso}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
