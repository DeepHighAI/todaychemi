import { z } from 'zod';

// 80자 상한 — 3계층 중 서버 Zod 계층 (클라이언트 counter + 이 값 + DB check constraint)
export const MEMO_BODY_MAX = 80;

export const MemoCreateSchema = z
  .object({
    body: z.string().trim().min(1).max(MEMO_BODY_MAX),
  })
  .strict();
export type MemoCreate = z.infer<typeof MemoCreateSchema>;

export const MemoUpdateSchema = z
  .object({
    body: z.string().trim().min(1).max(MEMO_BODY_MAX),
  })
  .strict();
export type MemoUpdate = z.infer<typeof MemoUpdateSchema>;

// DB Row — relation_memos 테이블 1:1
export interface MemoRow {
  memo_id: string;
  user_id: string;
  relation_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

// 클라이언트 노출 subset (user_id 미포함)
export type MemoItem = Pick<MemoRow, 'memo_id' | 'relation_id' | 'body' | 'created_at' | 'updated_at'>;

export interface MemoListResponse {
  items: MemoItem[];
}
export interface MemoCreateResponse {
  ok: true;
  memo: MemoItem;
}
export interface MemoUpdateResponse {
  ok: true;
  memo: MemoItem;
}

export const MEMO_ERROR_CODES = [
  'INVALID_BODY',
  'UNAUTHORIZED',
  'MEMO_NOT_FOUND',
  'RELATION_NOT_FOUND',
  'INTERNAL_ERROR',
] as const;
export type MemoErrorCode = (typeof MEMO_ERROR_CODES)[number];
