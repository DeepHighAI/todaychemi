export type PillarKey = '년' | '월' | '일' | '시';

interface PillarInfo {
  ko_short: string;
  ko_long: string;
  hanja: string;
}

const PILLAR_MAP: Record<PillarKey, PillarInfo> = {
  년: { ko_short: '년주', ko_long: '태어난 해의 기둥', hanja: '年柱' },
  월: { ko_short: '월주', ko_long: '태어난 달의 기둥', hanja: '月柱' },
  일: { ko_short: '일주', ko_long: '태어난 날의 기둥', hanja: '日柱' },
  시: { ko_short: '시주', ko_long: '태어난 시간의 기둥', hanja: '時柱' },
};

export function pillarDescriptor(key: PillarKey): PillarInfo {
  const info = PILLAR_MAP[key];
  if (!info) throw new Error(`Unknown pillar key: ${key}`);
  return info;
}
