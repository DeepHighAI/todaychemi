import { createHash } from 'node:crypto';

export interface ChartHashInput {
  entity_id: string;
  birth_date: string;
  birth_date_calendar: string;
  is_lunar_leap: boolean;
  effective_birth_time: string | null;
  gender: string;
  // 시주 진태양시 보정에 쓰인 유효 경도 (ADR-021 Amended) — 경도가 다르면 차트도 다르다
  birth_longitude: number;
  theory_profile_version: string;
}

// docs/specs/db_schema.md §2 — sha256(entity_id + birth_data + birth_longitude + theory_profile_version)
// entity_id: user_id for user_charts, relation_id for relation_charts
// 파이프('|') 구분자로 필드 순서 고정 → 결정형 보장
export function deriveChartHash(input: ChartHashInput): string {
  const payload = [
    input.entity_id,
    input.birth_date,
    input.birth_date_calendar,
    String(input.is_lunar_leap),
    input.effective_birth_time ?? 'null',
    input.gender,
    String(input.birth_longitude),
    input.theory_profile_version,
  ].join('|');
  return createHash('sha256').update(payload).digest('hex');
}
