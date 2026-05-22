import { z } from 'zod';
import { ClassicCitationBaseSchema } from '@/lib/rag/citation-schema';

export const WhatifLlmOutputSchema = z
  .object({
    body: z.string().min(80).max(700),
    keywords: z.tuple([z.string(), z.string(), z.string(), z.string(), z.string()]),
    do_first: z.tuple([z.string(), z.string(), z.string()]),
    first_meet_tips: z.tuple([z.string(), z.string(), z.string()]).optional(),
    classic_citation: z.array(ClassicCitationBaseSchema.strict()).optional(),
  })
  .strict();

export type WhatifLlmOutput = z.infer<typeof WhatifLlmOutputSchema>;
