import { z } from 'zod';
import { ClassicCitationBaseSchema } from '@/lib/rag/citation-schema';

const ShortText = z.string().min(1).max(180);
const MediumText = z.string().min(20).max(420);

export const WhatifLlmOutputSchema = z
  .object({
    body: z.string().min(180).max(900),
    keywords: z.tuple([z.string(), z.string(), z.string(), z.string(), z.string()]),
    today_context: z
      .object({
        title: ShortText,
        summary: MediumText,
        day_signal: ShortText,
      })
      .strict(),
    saju_basis: z
      .object({
        day_master: ShortText,
        dominant_sipsin: z.array(ShortText).max(5),
        missing_sipsin: z.array(ShortText).max(5),
        sinkang: ShortText.nullable(),
        yongsin_candidates: z.array(ShortText).max(5),
        notes: z.tuple([ShortText, ShortText, ShortText]),
      })
      .strict(),
    situation_reading: z
      .object({
        strength: z.tuple([ShortText, ShortText, ShortText]),
        caution: z.tuple([ShortText, ShortText, ShortText]),
      })
      .strict(),
    do_first: z.tuple([z.string(), z.string(), z.string()]),
    avoid_today: z.tuple([z.string(), z.string()]),
    first_meet_tips: z.tuple([z.string(), z.string(), z.string()]).optional(),
    classic_citation: z.array(ClassicCitationBaseSchema.strict()).optional(),
  })
  .strict();

export type WhatifLlmOutput = z.infer<typeof WhatifLlmOutputSchema>;
