import { z } from 'zod';

const ClassicCitationSchema = z.object({
  asset_id: z.string().min(1),
  source_title: z.string().min(1),
  source_chapter: z.string().min(1),
  original_text: z.string().min(1),
  modern_translation: z.string().min(1),
});

export const WhatifLlmOutputSchema = z
  .object({
    body: z.string().min(350).max(450),
    keywords: z.tuple([z.string(), z.string(), z.string(), z.string(), z.string()]),
    do_first: z.tuple([z.string(), z.string(), z.string()]),
    first_meet_tips: z.tuple([z.string(), z.string(), z.string()]).optional(),
    classic_citation: z.array(ClassicCitationSchema).optional(),
  })
  .strict();

export type WhatifLlmOutput = z.infer<typeof WhatifLlmOutputSchema>;
