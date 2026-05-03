import { z } from 'zod';

export const BirthDataSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hour: z.number().int().min(0).max(23).nullable(),
  minute: z.number().int().min(0).max(59).nullable(),
  calendar: z.enum(['solar', 'lunar']),
  gender: z.enum(['남', '여']),
});
export type BirthData = z.infer<typeof BirthDataSchema>;

export interface ChartCore {
  year_pillar: string;
  month_pillar: string;
  day_pillar: string;
  hour_pillar: string | null;
  day_master_element: '목' | '화' | '토' | '금' | '수';
  five_elements_counts: Record<'목' | '화' | '토' | '금' | '수', number>;
  gender_normalized: '남' | '여';
}

export type ChartHash = string;

export interface TheoryProfile {
  profile_version: string;
  ja_si_mode: 'late_zi' | 'early_zi';
  longitude_correction: boolean;
}
