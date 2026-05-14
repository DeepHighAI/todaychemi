import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('prompts/system/daily_hap.md — ADR-038 회귀', () => {
  it('daily_hap.md 예시 출력에 한자(漢字)가 없다', () => {
    const mdPath = path.resolve(process.cwd(), 'prompts', 'system', 'daily_hap.md');
    const md = readFileSync(mdPath, 'utf-8');
    // ```json {...} ``` 블록만 추출
    const blocks = md.match(/```json[\s\S]*?```/g) ?? [];
    // "headline" 키를 포함하는 블록 = Output example (Input format block 제외)
    const outputBlocks = blocks.filter((b) => b.includes('"headline"'));
    expect(outputBlocks.length).toBeGreaterThan(0);
    for (const block of outputBlocks) {
      // CJK Unified Ideographs 범위 U+4E00–U+9FFF
      expect(block).not.toMatch(/[一-鿿]/);
    }
  });
});
