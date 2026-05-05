import { createHash } from 'node:crypto';

export interface ChartHashInput {
  entity_id: string;
  birth_date: string;
  birth_date_calendar: string;
  is_lunar_leap: boolean;
  effective_birth_time: string | null;
  gender: string;
  theory_profile_version: string;
}

// docs/specs/db_schema.md §2 — sha256(entity_id + birth_data + theory_profile_version)
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
    input.theory_profile_version,
  ].join('|');
  return createHash('sha256').update(payload).digest('hex');
}
