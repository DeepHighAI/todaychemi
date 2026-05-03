// scripts/seed-kasi-reference.ts
// G0 게이트 참조 데이터 생성기 (ssaju 1차 시드)
// docs/specs/manseryeok_validation.md §15.2.5.6 참조
// 실행: pnpm tsx scripts/seed-kasi-reference.ts

import fs from 'node:fs';
import path from 'node:path';
import { calculateSaju } from 'ssaju';

const inputs = [
  // ── NORMAL 50건 (양력, 시간 known, 일반 출생 시각) ──
  // 60간지 일주 + 5일간 × 남/여 균등 분포
  { id: 'N001', category: 'normal' as const, input: { year: 1990, month: 3, day: 15, hour: 14, minute: 30, gender: '남' as const, calendar: 'solar' as const } },
  { id: 'N002', category: 'normal' as const, input: { year: 1985, month: 7, day: 22, hour: 8,  minute: 0,  gender: '여' as const, calendar: 'solar' as const } },
  { id: 'N003', category: 'normal' as const, input: { year: 1993, month: 11, day: 5, hour: 20, minute: 45, gender: '남' as const, calendar: 'solar' as const } },
  { id: 'N004', category: 'normal' as const, input: { year: 1978, month: 4, day: 30, hour: 6,  minute: 15, gender: '여' as const, calendar: 'solar' as const } },
  { id: 'N005', category: 'normal' as const, input: { year: 2001, month: 9, day: 12, hour: 16, minute: 0,  gender: '남' as const, calendar: 'solar' as const } },
  { id: 'N006', category: 'normal' as const, input: { year: 1967, month: 1, day: 18, hour: 10, minute: 30, gender: '여' as const, calendar: 'solar' as const } },
  { id: 'N007', category: 'normal' as const, input: { year: 1995, month: 6, day: 3,  hour: 22, minute: 20, gender: '남' as const, calendar: 'solar' as const } },
  { id: 'N008', category: 'normal' as const, input: { year: 1982, month: 12, day: 25, hour: 4, minute: 0,  gender: '여' as const, calendar: 'solar' as const } },
  { id: 'N009', category: 'normal' as const, input: { year: 1970, month: 8, day: 7,  hour: 18, minute: 10, gender: '남' as const, calendar: 'solar' as const } },
  { id: 'N010', category: 'normal' as const, input: { year: 2005, month: 2, day: 14, hour: 12, minute: 0,  gender: '여' as const, calendar: 'solar' as const } },
  { id: 'N011', category: 'normal' as const, input: { year: 1988, month: 5, day: 20, hour: 7,  minute: 30, gender: '남' as const, calendar: 'solar' as const } },
  { id: 'N012', category: 'normal' as const, input: { year: 1975, month: 10, day: 11, hour: 15, minute: 45, gender: '여' as const, calendar: 'solar' as const } },
  { id: 'N013', category: 'normal' as const, input: { year: 1999, month: 3, day: 28, hour: 9,  minute: 0,  gender: '남' as const, calendar: 'solar' as const } },
  { id: 'N014', category: 'normal' as const, input: { year: 1963, month: 7, day: 4,  hour: 23, minute: 50, gender: '여' as const, calendar: 'solar' as const } },
  { id: 'N015', category: 'normal' as const, input: { year: 2003, month: 11, day: 19, hour: 3, minute: 15, gender: '남' as const, calendar: 'solar' as const } },
  { id: 'N016', category: 'normal' as const, input: { year: 1980, month: 4, day: 8,  hour: 11, minute: 0,  gender: '여' as const, calendar: 'solar' as const } },
  { id: 'N017', category: 'normal' as const, input: { year: 1956, month: 9, day: 27, hour: 17, minute: 30, gender: '남' as const, calendar: 'solar' as const } },
  { id: 'N018', category: 'normal' as const, input: { year: 1992, month: 1, day: 13, hour: 5,  minute: 45, gender: '여' as const, calendar: 'solar' as const } },
  { id: 'N019', category: 'normal' as const, input: { year: 1973, month: 6, day: 30, hour: 19, minute: 20, gender: '남' as const, calendar: 'solar' as const } },
  { id: 'N020', category: 'normal' as const, input: { year: 2007, month: 2, day: 5,  hour: 13, minute: 0,  gender: '여' as const, calendar: 'solar' as const } },
  { id: 'N021', category: 'normal' as const, input: { year: 1987, month: 8, day: 17, hour: 21, minute: 30, gender: '남' as const, calendar: 'solar' as const } },
  { id: 'N022', category: 'normal' as const, input: { year: 1969, month: 12, day: 9, hour: 8,  minute: 15, gender: '여' as const, calendar: 'solar' as const } },
  { id: 'N023', category: 'normal' as const, input: { year: 1997, month: 4, day: 23, hour: 16, minute: 0,  gender: '남' as const, calendar: 'solar' as const } },
  { id: 'N024', category: 'normal' as const, input: { year: 1960, month: 10, day: 16, hour: 2, minute: 30, gender: '여' as const, calendar: 'solar' as const } },
  { id: 'N025', category: 'normal' as const, input: { year: 2010, month: 5, day: 31, hour: 10, minute: 45, gender: '남' as const, calendar: 'solar' as const } },
  { id: 'N026', category: 'normal' as const, input: { year: 1983, month: 3, day: 6,  hour: 14, minute: 0,  gender: '여' as const, calendar: 'solar' as const } },
  { id: 'N027', category: 'normal' as const, input: { year: 1954, month: 7, day: 20, hour: 7,  minute: 30, gender: '남' as const, calendar: 'solar' as const } },
  { id: 'N028', category: 'normal' as const, input: { year: 2000, month: 11, day: 1, hour: 22, minute: 15, gender: '여' as const, calendar: 'solar' as const } },
  { id: 'N029', category: 'normal' as const, input: { year: 1976, month: 6, day: 14, hour: 4,  minute: 0,  gender: '남' as const, calendar: 'solar' as const } },
  { id: 'N030', category: 'normal' as const, input: { year: 1991, month: 1, day: 29, hour: 18, minute: 45, gender: '여' as const, calendar: 'solar' as const } },
  { id: 'N031', category: 'normal' as const, input: { year: 1965, month: 9, day: 10, hour: 11, minute: 30, gender: '남' as const, calendar: 'solar' as const } },
  { id: 'N032', category: 'normal' as const, input: { year: 2004, month: 3, day: 25, hour: 20, minute: 0,  gender: '여' as const, calendar: 'solar' as const } },
  { id: 'N033', category: 'normal' as const, input: { year: 1979, month: 8, day: 3,  hour: 6,  minute: 20, gender: '남' as const, calendar: 'solar' as const } },
  { id: 'N034', category: 'normal' as const, input: { year: 1958, month: 12, day: 18, hour: 15, minute: 0, gender: '여' as const, calendar: 'solar' as const } },
  { id: 'N035', category: 'normal' as const, input: { year: 1996, month: 5, day: 7,  hour: 9,  minute: 10, gender: '남' as const, calendar: 'solar' as const } },
  { id: 'N036', category: 'normal' as const, input: { year: 1971, month: 10, day: 24, hour: 23, minute: 30, gender: '여' as const, calendar: 'solar' as const } },
  { id: 'N037', category: 'normal' as const, input: { year: 2008, month: 4, day: 16, hour: 3,  minute: 45, gender: '남' as const, calendar: 'solar' as const } },
  { id: 'N038', category: 'normal' as const, input: { year: 1984, month: 7, day: 31, hour: 13, minute: 0,  gender: '여' as const, calendar: 'solar' as const } },
  { id: 'N039', category: 'normal' as const, input: { year: 1961, month: 2, day: 8,  hour: 17, minute: 15, gender: '남' as const, calendar: 'solar' as const } },
  { id: 'N040', category: 'normal' as const, input: { year: 1998, month: 11, day: 21, hour: 5, minute: 30, gender: '여' as const, calendar: 'solar' as const } },
  { id: 'N041', category: 'normal' as const, input: { year: 1974, month: 6, day: 12, hour: 21, minute: 0,  gender: '남' as const, calendar: 'solar' as const } },
  { id: 'N042', category: 'normal' as const, input: { year: 2002, month: 9, day: 29, hour: 8,  minute: 40, gender: '여' as const, calendar: 'solar' as const } },
  { id: 'N043', category: 'normal' as const, input: { year: 1966, month: 3, day: 17, hour: 16, minute: 0,  gender: '남' as const, calendar: 'solar' as const } },
  { id: 'N044', category: 'normal' as const, input: { year: 1989, month: 7, day: 4,  hour: 10, minute: 20, gender: '여' as const, calendar: 'solar' as const } },
  { id: 'N045', category: 'normal' as const, input: { year: 1952, month: 12, day: 3, hour: 2,  minute: 0,  gender: '남' as const, calendar: 'solar' as const } },
  { id: 'N046', category: 'normal' as const, input: { year: 2006, month: 4, day: 28, hour: 19, minute: 15, gender: '여' as const, calendar: 'solar' as const } },
  { id: 'N047', category: 'normal' as const, input: { year: 1977, month: 8, day: 15, hour: 7,  minute: 0,  gender: '남' as const, calendar: 'solar' as const } },
  { id: 'N048', category: 'normal' as const, input: { year: 1994, month: 2, day: 22, hour: 14, minute: 50, gender: '여' as const, calendar: 'solar' as const } },
  { id: 'N049', category: 'normal' as const, input: { year: 1968, month: 10, day: 9, hour: 20, minute: 30, gender: '남' as const, calendar: 'solar' as const } },
  { id: 'N050', category: 'normal' as const, input: { year: 2009, month: 6, day: 17, hour: 11, minute: 0,  gender: '여' as const, calendar: 'solar' as const } },

  // ── BOUNDARY 30건 (절기 경계 전후 1일, 자정 전후, 자시 경계) ──
  { id: 'B001', category: 'boundary' as const, input: { year: 1990, month: 2, day: 4,  hour: 5,  minute: 15, gender: '남' as const, calendar: 'solar' as const } }, // 입춘 당일
  { id: 'B002', category: 'boundary' as const, input: { year: 1990, month: 2, day: 3,  hour: 23, minute: 59, gender: '여' as const, calendar: 'solar' as const } }, // 입춘 전날 자정 전
  { id: 'B003', category: 'boundary' as const, input: { year: 1990, month: 2, day: 5,  hour: 0,  minute: 1,  gender: '남' as const, calendar: 'solar' as const } }, // 입춘 다음날
  { id: 'B004', category: 'boundary' as const, input: { year: 1985, month: 3, day: 21, hour: 12, minute: 0,  gender: '여' as const, calendar: 'solar' as const } }, // 춘분
  { id: 'B005', category: 'boundary' as const, input: { year: 1985, month: 3, day: 20, hour: 23, minute: 30, gender: '남' as const, calendar: 'solar' as const } }, // 춘분 전날 심야
  { id: 'B006', category: 'boundary' as const, input: { year: 1993, month: 4, day: 20, hour: 8,  minute: 0,  gender: '여' as const, calendar: 'solar' as const } }, // 곡우
  { id: 'B007', category: 'boundary' as const, input: { year: 1993, month: 4, day: 19, hour: 22, minute: 45, gender: '남' as const, calendar: 'solar' as const } }, // 곡우 전날
  { id: 'B008', category: 'boundary' as const, input: { year: 1999, month: 6, day: 21, hour: 14, minute: 0,  gender: '여' as const, calendar: 'solar' as const } }, // 하지
  { id: 'B009', category: 'boundary' as const, input: { year: 1999, month: 6, day: 20, hour: 23, minute: 55, gender: '남' as const, calendar: 'solar' as const } }, // 하지 전날 심야
  { id: 'B010', category: 'boundary' as const, input: { year: 2001, month: 8, day: 7,  hour: 6,  minute: 30, gender: '여' as const, calendar: 'solar' as const } }, // 입추
  { id: 'B011', category: 'boundary' as const, input: { year: 2001, month: 8, day: 6,  hour: 23, minute: 0,  gender: '남' as const, calendar: 'solar' as const } }, // 입추 전날
  { id: 'B012', category: 'boundary' as const, input: { year: 1995, month: 9, day: 23, hour: 10, minute: 20, gender: '여' as const, calendar: 'solar' as const } }, // 추분
  { id: 'B013', category: 'boundary' as const, input: { year: 1995, month: 9, day: 22, hour: 23, minute: 30, gender: '남' as const, calendar: 'solar' as const } }, // 추분 전날
  { id: 'B014', category: 'boundary' as const, input: { year: 1988, month: 11, day: 7, hour: 9,  minute: 0,  gender: '여' as const, calendar: 'solar' as const } }, // 입동
  { id: 'B015', category: 'boundary' as const, input: { year: 1988, month: 11, day: 6, hour: 22, minute: 45, gender: '남' as const, calendar: 'solar' as const } }, // 입동 전날
  { id: 'B016', category: 'boundary' as const, input: { year: 1970, month: 12, day: 22, hour: 3, minute: 30, gender: '여' as const, calendar: 'solar' as const } }, // 동지
  { id: 'B017', category: 'boundary' as const, input: { year: 1970, month: 12, day: 21, hour: 23, minute: 50, gender: '남' as const, calendar: 'solar' as const } }, // 동지 전날
  { id: 'B018', category: 'boundary' as const, input: { year: 1982, month: 1, day: 1,  hour: 0,  minute: 5,  gender: '여' as const, calendar: 'solar' as const } }, // 연 첫날 자정 직후
  { id: 'B019', category: 'boundary' as const, input: { year: 1981, month: 12, day: 31, hour: 23, minute: 55, gender: '남' as const, calendar: 'solar' as const } }, // 연 마지막날 자정 전
  { id: 'B020', category: 'boundary' as const, input: { year: 1990, month: 3, day: 6,  hour: 0,  minute: 2,  gender: '여' as const, calendar: 'solar' as const } }, // 자정 직후
  { id: 'B021', category: 'boundary' as const, input: { year: 1990, month: 3, day: 5,  hour: 23, minute: 58, gender: '남' as const, calendar: 'solar' as const } }, // 자정 직전 (자시)
  { id: 'B022', category: 'boundary' as const, input: { year: 1975, month: 5, day: 21, hour: 23, minute: 0,  gender: '여' as const, calendar: 'solar' as const } }, // 밤 11시 (자시 경계)
  { id: 'B023', category: 'boundary' as const, input: { year: 1975, month: 5, day: 22, hour: 1,  minute: 0,  gender: '남' as const, calendar: 'solar' as const } }, // 새벽 1시
  { id: 'B024', category: 'boundary' as const, input: { year: 2003, month: 2, day: 4,  hour: 10, minute: 12, gender: '여' as const, calendar: 'solar' as const } }, // 입춘 당일 오전
  { id: 'B025', category: 'boundary' as const, input: { year: 2003, month: 2, day: 3,  hour: 10, minute: 0,  gender: '남' as const, calendar: 'solar' as const } }, // 입춘 전날
  { id: 'B026', category: 'boundary' as const, input: { year: 1997, month: 7, day: 7,  hour: 11, minute: 0,  gender: '여' as const, calendar: 'solar' as const } }, // 소서
  { id: 'B027', category: 'boundary' as const, input: { year: 1997, month: 7, day: 6,  hour: 23, minute: 30, gender: '남' as const, calendar: 'solar' as const } }, // 소서 전날
  { id: 'B028', category: 'boundary' as const, input: { year: 2000, month: 1, day: 1,  hour: 0,  minute: 0,  gender: '여' as const, calendar: 'solar' as const } }, // 2000년 원단
  { id: 'B029', category: 'boundary' as const, input: { year: 1960, month: 2, day: 5,  hour: 6,  minute: 0,  gender: '남' as const, calendar: 'solar' as const } }, // 입춘 주변
  { id: 'B030', category: 'boundary' as const, input: { year: 2010, month: 8, day: 7,  hour: 23, minute: 45, gender: '여' as const, calendar: 'solar' as const } }, // 입추 당일 심야

  // ── EDGE 20건 (음력, 시간 미상, 극단 날짜, 윤달) ──
  { id: 'E001', category: 'edge' as const, input: { year: 1995, month: 8, day: 15, hour: 12, minute: 0,  gender: '남' as const, calendar: 'lunar' as const } }, // 음력 추석
  { id: 'E002', category: 'edge' as const, input: { year: 1990, month: 1, day: 1,  hour: 6,  minute: 0,  gender: '여' as const, calendar: 'lunar' as const } }, // 음력 설날
  { id: 'E003', category: 'edge' as const, input: { year: 2000, month: 4, day: 15, hour: 10, minute: 0,  gender: '남' as const, calendar: 'lunar' as const } }, // 음력 4월15일
  { id: 'E004', category: 'edge' as const, input: { year: 1985, month: 7, day: 7,  hour: 14, minute: 0,  gender: '여' as const, calendar: 'lunar' as const } }, // 음력 칠석
  { id: 'E005', category: 'edge' as const, input: { year: 1975, month: 5, day: 5,  hour: 9,  minute: 0,  gender: '남' as const, calendar: 'lunar' as const } }, // 음력 단오
  { id: 'E006', category: 'edge' as const, input: { year: 1950, month: 6, day: 25, hour: 4,  minute: 0,  gender: '여' as const, calendar: 'solar' as const } }, // 한국전쟁 발발일
  { id: 'E007', category: 'edge' as const, input: { year: 1910, month: 8, day: 29, hour: 12, minute: 0,  gender: '남' as const, calendar: 'solar' as const } }, // 역사적 날짜 (1900년대 초)
  { id: 'E008', category: 'edge' as const, input: { year: 2025, month: 12, day: 31, hour: 23, minute: 59, gender: '여' as const, calendar: 'solar' as const } }, // 미래 날짜
  { id: 'E009', category: 'edge' as const, input: { year: 2030, month: 6, day: 15, hour: 14, minute: 30, gender: '남' as const, calendar: 'solar' as const } }, // 미래 날짜
  { id: 'E010', category: 'edge' as const, input: { year: 1900, month: 1, day: 1,  hour: 12, minute: 0,  gender: '여' as const, calendar: 'solar' as const } }, // 극단 과거
  { id: 'E011', category: 'edge' as const, input: { year: 1990, month: 3, day: 15, hour: 12, minute: 0,  gender: '남' as const, calendar: 'solar' as const } }, // 시간 known (정오 정각)
  { id: 'E012', category: 'edge' as const, input: { year: 1988, month: 6, day: 29, hour: 0,  minute: 0,  gender: '여' as const, calendar: 'solar' as const } }, // 자정 0시 0분
  { id: 'E013', category: 'edge' as const, input: { year: 1993, month: 9, day: 30, hour: 23, minute: 59, gender: '남' as const, calendar: 'solar' as const } }, // 하루 끝
  { id: 'E014', category: 'edge' as const, input: { year: 1980, month: 2, day: 29, hour: 10, minute: 0,  gender: '여' as const, calendar: 'solar' as const } }, // 윤년 2월 29일
  { id: 'E015', category: 'edge' as const, input: { year: 2000, month: 2, day: 29, hour: 15, minute: 0,  gender: '남' as const, calendar: 'solar' as const } }, // 2000년 윤년
  { id: 'E016', category: 'edge' as const, input: { year: 1976, month: 8, day: 15, hour: 8,  minute: 0,  gender: '여' as const, calendar: 'lunar' as const, leap: true } }, // 음력 윤8월
  { id: 'E017', category: 'edge' as const, input: { year: 1963, month: 11, day: 22, hour: 18, minute: 30, gender: '남' as const, calendar: 'solar' as const } }, // JFK 암살일
  { id: 'E018', category: 'edge' as const, input: { year: 1945, month: 8, day: 15, hour: 12, minute: 0,  gender: '여' as const, calendar: 'solar' as const } }, // 광복절
  { id: 'E019', category: 'edge' as const, input: { year: 2020, month: 2, day: 29, hour: 20, minute: 0,  gender: '남' as const, calendar: 'solar' as const } }, // 2020년 윤년
  { id: 'E020', category: 'edge' as const, input: { year: 1955, month: 1, day: 5,  hour: 1,  minute: 30, gender: '여' as const, calendar: 'solar' as const } }, // 소한 근처
];

const output = inputs.map((item) => {
  try {
    const r = calculateSaju(item.input);
    return {
      id: item.id,
      category: item.category,
      input: item.input,
      expected: {
        year_pillar: r.pillars.year,
        month_pillar: r.pillars.month,
        day_pillar: r.pillars.day,
        hour_pillar: r.pillars.hour,
        day_master_stem: r.dayStem,
        five_elements_counts: r.fiveElements,
        source: 'ssaju_seed_pending_kasi_validation',
      },
    };
  } catch (err) {
    console.warn(`WARN: ${item.id} failed: ${(err as Error).message}`);
    return {
      id: item.id,
      category: item.category,
      input: item.input,
      expected: {
        year_pillar: '_ERROR',
        month_pillar: '_ERROR',
        day_pillar: '_ERROR',
        hour_pillar: '_ERROR',
        day_master_stem: '_ERROR',
        five_elements_counts: {},
        source: 'ssaju_seed_pending_kasi_validation',
      },
    };
  }
});

const outPath = path.join(__dirname, '..', 'tests', 'fixtures', 'kasi_reference_100.json');
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

const normal = output.filter(o => o.category === 'normal').length;
const boundary = output.filter(o => o.category === 'boundary').length;
const edge = output.filter(o => o.category === 'edge').length;
const errors = output.filter(o => o.expected.year_pillar === '_ERROR').length;

console.log(`Generated ${output.length} samples: normal=${normal} boundary=${boundary} edge=${edge}`);
if (errors > 0) console.warn(`WARN: ${errors} samples had errors`);
console.log(`Saved to ${outPath}`);
console.log('NOTE: expected values are ssaju 1차 시드. Phil이 KASI 진본으로 검증·정정 필요 (PR-3).');
