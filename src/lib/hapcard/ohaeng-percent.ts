type OhaengKey = '목' | '화' | '토' | '금' | '수';
type OhaengCounts = Record<OhaengKey, number>;

const KEYS: OhaengKey[] = ['목', '화', '토', '금', '수'];

export function toPercent(counts: OhaengCounts): OhaengCounts {
  for (const k of KEYS) {
    const v = counts[k] ?? 0;
    if (v < 0) throw new Error(`ohaeng count must be non-negative, got ${k}=${v}`);
  }
  const sum = KEYS.reduce((s, k) => s + (counts[k] ?? 0), 0);
  if (sum === 0) return { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
  return KEYS.reduce(
    (acc, k) => ({ ...acc, [k]: ((counts[k] ?? 0) / sum) * 100 }),
    {} as OhaengCounts,
  );
}
