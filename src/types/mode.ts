import { z } from 'zod';

export const MODE = {
  ILHAP: '일합',
  CHINGUHAP: '친구합',
  DONHAP: '돈합',
  CHEOTHAP: '첫합',
  SSEOMHAP: '썸합',
  ORAEHAP: '오래합',
} as const;

export const ModeSchema = z.enum(['일합', '친구합', '돈합', '첫합', '썸합', '오래합']);
export type Mode = z.infer<typeof ModeSchema>;
