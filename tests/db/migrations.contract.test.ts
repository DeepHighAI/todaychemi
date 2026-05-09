import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { MIGRATIONS_MANIFEST } from './migrations.manifest';

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'supabase/migrations');

for (const spec of MIGRATIONS_MANIFEST) {
  describe(`migration ${spec.file}`, () => {
    it('파일이 존재하고 DDL 계약을 만족한다', () => {
      const filePath = path.join(MIGRATIONS_DIR, spec.file);
      if (!fs.existsSync(filePath)) {
        throw new Error(`마이그레이션 파일 없음: ${spec.file}`);
      }
      const sql = fs.readFileSync(filePath, 'utf-8');
      const lower = sql.toLowerCase();

      if (spec.kind === 'extensions') {
        for (const ext of spec.extensions) {
          expect(lower, `extension "${ext}" 선언 누락`).toContain(`"${ext}"`);
        }
        return;
      }

      if (spec.kind === 'table') {
        expect(lower, `create table public.${spec.tableName} 누락`).toContain(
          `create table public.${spec.tableName}`,
        );
        for (const col of spec.columns) {
          expect(sql, `컬럼 ${col} 누락`).toContain(col);
        }
        for (const ce of spec.checkEnums) {
          for (const v of ce.values) {
            expect(sql, `CHECK enum 값 '${v}' 누락 (${ce.col} 컬럼)`).toContain(`'${v}'`);
          }
        }
        expect(lower, 'enable row level security 누락').toContain('enable row level security');
        for (const policy of spec.rls.policies) {
          expect(sql, `RLS 정책 "${policy}" 누락`).toContain(`"${policy}"`);
        }
        if (spec.cronJobs) {
          for (const job of spec.cronJobs) {
            expect(sql, `cron job '${job}' 누락`).toContain(`'${job}'`);
          }
        }
        return;
      }

      if (spec.kind === 'function') {
        expect(lower, `create or replace function public.${spec.functionName} 누락`).toContain(
          `create or replace function public.${spec.functionName}`,
        );
        if (spec.cronJobs) {
          for (const job of spec.cronJobs) {
            expect(sql, `cron job '${job}' 누락`).toContain(`'${job}'`);
          }
        }
      }
    });
  });
}
