import { z } from 'zod';

export const RelationCreateSchema = z.object({
  nickname: z.string().min(1).max(20),
  gender: z.enum(['남', '여']),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  birth_time_known: z.boolean(),
  birth_hour: z.number().int().min(0).max(23).nullable(),
  birth_minute: z.number().int().min(0).max(59).nullable(),
  birth_calendar: z.enum(['solar', 'lunar']),
  relationship_tag: z.string().max(30).optional(),
});
export type RelationCreate = z.infer<typeof RelationCreateSchema>;

export interface RelationRow {
  id: string;
  user_id: string;
  nickname: string;
  gender: '남' | '여';
  birth_date: string;
  birth_time_known: boolean;
  birth_hour: number | null;
  birth_minute: number | null;
  birth_calendar: 'solar' | 'lunar';
  relationship_tag: string | null;
  created_at: string;
  archived_at: string | null;
}
