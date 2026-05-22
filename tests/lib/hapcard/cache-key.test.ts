import { describe, it, expect } from 'vitest';
import { deriveCacheKey } from '@/lib/hapcard/cache-key';
import type { Mode } from '@/types/mode';

const BASE = {
  user_chart_hash: 'a'.repeat(64),
  relation_chart_hash: 'b'.repeat(64),
  mode: '일합' as Mode,
  prompt_version: 'v0.2',
  theory_profile_version: '2026-05',
  target_date: '2026-05-21',
};

describe('deriveCacheKey — llm_governance §1.3', () => {
  describe('출력 형식', () => {
    it('SHA-256 hex 64자', () => {
      const key = deriveCacheKey(BASE);
      expect(key).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('결정성', () => {
    it('동일 입력 = 동일 키', () => {
      const k1 = deriveCacheKey(BASE);
      const k2 = deriveCacheKey(BASE);
      expect(k1).toBe(k2);
    });

    it('동일 입력 1000회 unique=1', () => {
      const keys = Array.from({ length: 1000 }, () => deriveCacheKey(BASE));
      expect(new Set(keys).size).toBe(1);
    });
  });

  describe('필드 민감도 — 6필드 변경 시 다른 키', () => {
    it('user_chart_hash 변경 → 다른 키', () => {
      const a = deriveCacheKey(BASE);
      const b = deriveCacheKey({ ...BASE, user_chart_hash: 'c'.repeat(64) });
      expect(a).not.toBe(b);
    });

    it('relation_chart_hash 변경 → 다른 키', () => {
      const a = deriveCacheKey(BASE);
      const b = deriveCacheKey({ ...BASE, relation_chart_hash: 'd'.repeat(64) });
      expect(a).not.toBe(b);
    });

    it('mode 변경 → 다른 키', () => {
      const a = deriveCacheKey(BASE);
      const b = deriveCacheKey({ ...BASE, mode: '친구합' });
      expect(a).not.toBe(b);
    });

    it('prompt_version 변경 → 다른 키', () => {
      const a = deriveCacheKey(BASE);
      const b = deriveCacheKey({ ...BASE, prompt_version: 'v0.3' });
      expect(a).not.toBe(b);
    });

    it('theory_profile_version 변경 → 다른 키', () => {
      const a = deriveCacheKey(BASE);
      const b = deriveCacheKey({ ...BASE, theory_profile_version: '2026-06' });
      expect(a).not.toBe(b);
    });

    it('target_date 변경 → 다른 키', () => {
      const a = deriveCacheKey(BASE);
      const b = deriveCacheKey({ ...BASE, target_date: '2026-05-22' });
      expect(a).not.toBe(b);
    });
  });

  describe('6모드 모두 별도 키', () => {
    it('일합 / 친구합 / 돈합 / 첫합 / 썸합 / 오래합 = 6 unique keys', () => {
      const modes: Mode[] = ['일합', '친구합', '돈합', '첫합', '썸합', '오래합'];
      const keys = modes.map((mode) => deriveCacheKey({ ...BASE, mode }));
      expect(new Set(keys).size).toBe(6);
    });
  });

  describe('필드 순서 고정 (동일 데이터, 다른 객체 키 순서)', () => {
    it('객체 리터럴 키 순서가 달라도 동일 키', () => {
      const a = deriveCacheKey({
        user_chart_hash: BASE.user_chart_hash,
        relation_chart_hash: BASE.relation_chart_hash,
        mode: BASE.mode,
        prompt_version: BASE.prompt_version,
        theory_profile_version: BASE.theory_profile_version,
        target_date: BASE.target_date,
      });
      const b = deriveCacheKey({
        target_date: BASE.target_date,
        theory_profile_version: BASE.theory_profile_version,
        prompt_version: BASE.prompt_version,
        mode: BASE.mode,
        relation_chart_hash: BASE.relation_chart_hash,
        user_chart_hash: BASE.user_chart_hash,
      });
      expect(a).toBe(b);
    });
  });
});
