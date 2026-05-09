import { z } from 'zod';

export const ClassicCitationBaseSchema = z.object({
  asset_id: z.string().min(1),
  source_title: z.string().min(1),
  source_chapter: z.string().min(1),
  original_text: z.string().min(1),
  modern_translation: z.string().min(1),
});

export const HapcardClassicCitationSchema = ClassicCitationBaseSchema.extend({
  original_reading: z.string().optional(),
  relevance_explanation: z.string().min(1),
  reference_url: z.string().url().optional(),
}).strict();

export type ClassicCitationBase = z.infer<typeof ClassicCitationBaseSchema>;
export type HapcardClassicCitation = z.infer<typeof HapcardClassicCitationSchema>;
