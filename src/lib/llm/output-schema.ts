import { z } from 'zod';
import { HapcardClassicCitationSchema } from '@/lib/rag/citation-schema';

// llm_grounding.md §5 + plan Q5 — LLM 출력 strict Zod schema
// strict() 로 unknown 키 거부. 점수 누설(score, compat_score 등) 차단.

const CauseFactorSchema = z
  .object({
    name: z.string().min(1),
    effect: z.string().min(1),
  })
  .strict();

const WhyCardSchema = z
  .object({
    title: z.string().min(1),
    reason: z.string().min(1),
  })
  .strict();

const OhaengInterpretationPointSchema = z
  .object({
    label: z.string().min(1),
    body: z.string().min(1),
  })
  .strict();

export const OhaengInterpretationSchema = z
  .object({
    title: z.string().min(1),
    summary: z.string().min(1),
    points: z.array(OhaengInterpretationPointSchema).length(3),
    tip: z.string().min(1),
  })
  .strict();

export const HapcardLlmOutputSchema = z
  .object({
    main_text: z.string().min(120).max(280),
    cause_factors: z.array(CauseFactorSchema).length(3),
    classic_citation: z.array(HapcardClassicCitationSchema),
    actions: z.array(z.string().min(1)).length(4),
    why_cards: z.array(WhyCardSchema).min(1),
    ohaeng_interpretation: OhaengInterpretationSchema,
  })
  .strict();

export type HapcardLlmOutput = z.infer<typeof HapcardLlmOutputSchema>;
