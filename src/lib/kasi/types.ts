import { z } from 'zod';

export const KasiLunCalItemSchema = z.object({
  lunSecha: z.string().min(1),
  lunWolgeon: z.string(),
  lunIljin: z.string().min(1),
  lunYear: z.coerce.number().optional(),
  lunMonth: z.coerce.number().optional(),
  lunDay: z.coerce.number().optional(),
  lunLeapmonth: z.string().optional(),
  lunNday: z.coerce.number().optional(),
  solYear: z.coerce.number().optional(),
  solMonth: z.coerce.number().optional(),
  solDay: z.coerce.number().optional(),
  lunYibgi: z.string().optional(),
});
export type KasiLunCalItem = z.infer<typeof KasiLunCalItemSchema>;

export const KasiLunCalResponseSchema = z.object({
  response: z.object({
    header: z.object({
      resultCode: z.literal('00'),
      resultMsg: z.string(),
    }),
    body: z.object({
      items: z.object({
        item: KasiLunCalItemSchema,
      }),
      numOfRows: z.number().optional(),
      pageNo: z.number().optional(),
      totalCount: z.number().optional(),
    }),
  }),
});
export type KasiLunCalResponse = z.infer<typeof KasiLunCalResponseSchema>;
