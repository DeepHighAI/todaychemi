// scripts/fetch-kasi-reference.ts
// KASI 진본 픽스처 생성기 — 실행: pnpm seed-kasi
// docs/specs/manseryeok_validation.md §4.3 참조
import fs from 'node:fs';
import path from 'node:path';

// tsx 직접 실행 시 Next.js가 .env.local을 자동 로드하지 않으므로 수동 로드
const envLocalPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envLocalPath)) {
  for (const line of fs.readFileSync(envLocalPath, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
import { fetchLunCalInfo } from '../src/lib/kasi/client';
import { buildKasiFixtures } from '../src/lib/kasi/seed-runner';
import { KASI_SEED_INPUTS } from './lib/kasi-seed-inputs';

const SERVICE_KEY = process.env.KASI_SERVICE_KEY ?? '';
if (!SERVICE_KEY) {
  console.error('ERROR: KASI_SERVICE_KEY 환경변수가 필요합니다.');
  process.exit(1);
}

const OUT_PATH = path.join(__dirname, '..', 'tests', 'fixtures', 'kasi_reference_100.json');
const PARTIAL_PATH = path.join(__dirname, '..', 'tests', 'fixtures', '.kasi_partial.json');
const RATE_LIMIT_MS = 1000;

// 음력→양력 변환: KASI getSolCalInfo 호출
async function lunarToSolar(
  lunYear: number, lunMonth: number, lunDay: number, isLeap = false,
): Promise<{ year: number; month: number; day: number }> {
  const leapStr = isLeap ? 'true' : 'false';
  const mm = String(lunMonth).padStart(2, '0');
  const dd = String(lunDay).padStart(2, '0');
  const url =
    `https://apis.data.go.kr/B090041/openapi/service/LrsrCldInfoService/getSolCalInfo` +
    `?lunYear=${lunYear}&lunMonth=${mm}&lunDay=${dd}&lunLeapmonth=${leapStr}` +
    `&_type=json&serviceKey=${SERVICE_KEY}`;
  const res = await fetch(url);
  const json = await res.json() as {
    response: { body: { items: string | { item: { solYear: number; solMonth: number | string; solDay: number | string } | Array<{ solYear: number; solMonth: number | string; solDay: number | string; lunLeapmonth: string }> } } };
  };
  const items = json.response.body.items;
  if (!items || typeof items === 'string') throw new Error('lunarToSolar: no items returned');
  const raw = items.item;
  // 같은 음력 날짜에 평달+윤달 2건 반환될 수 있음 — isLeap에 맞는 것 선택
  const targetLeap = isLeap ? '윤' : '평';
  const item = Array.isArray(raw)
    ? (raw.find((r) => r.lunLeapmonth === targetLeap) ?? raw[0])
    : raw;
  return {
    year: Number(item.solYear),
    month: Number(item.solMonth),
    day: Number(item.solDay),
  };
}

async function fetchSolar(year: number, month: number, day: number) {
  return fetchLunCalInfo(year, month, day, SERVICE_KEY);
}

async function main() {
  console.log(`KASI 픽스처 생성 시작 — ${KASI_SEED_INPUTS.length}건`);

  const { records, failures } = await buildKasiFixtures(KASI_SEED_INPUTS, {
    fetchSolar,
    lunarToSolar,
    partialPath: PARTIAL_PATH,
  });

  if (failures.length > 0) {
    console.warn(`WARN: ${failures.length}건 실패: ${failures.join(', ')}`);
  }

  // 원자적 저장
  fs.writeFileSync(OUT_PATH, JSON.stringify(records, null, 2), 'utf-8');
  if (fs.existsSync(PARTIAL_PATH)) fs.unlinkSync(PARTIAL_PATH);

  console.log(`완료: ${records.length}건 저장 → ${OUT_PATH}`);
  if (failures.length > 0) {
    console.error(`실패 ${failures.length}건 있음 — .kasi_partial.json 재시도 후 확인`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
