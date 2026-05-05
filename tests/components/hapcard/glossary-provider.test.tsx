// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { GlossaryProvider, useGlossaryContext } from '@/components/hapcard/glossary-provider';

function SingleConsumer({ term, resultRef }: { term: string; resultRef: { current: boolean | null } }) {
  const { consume } = useGlossaryContext();
  resultRef.current = consume(term);
  return null;
}

function DoubleConsumer({ term, results }: { term: string; results: boolean[] }) {
  const { consume } = useGlossaryContext();
  results.push(consume(term));
  results.push(consume(term));
  return null;
}

describe('GlossaryProvider', () => {
  it('첫 번째 consume → true (isFirst)', () => {
    const ref = { current: null as boolean | null };
    render(
      <GlossaryProvider>
        <SingleConsumer term="일주" resultRef={ref} />
      </GlossaryProvider>
    );
    expect(ref.current).toBe(true);
  });

  it('같은 용어의 두 번째 consume → false', () => {
    const results: boolean[] = [];
    render(
      <GlossaryProvider>
        <DoubleConsumer term="일주" results={results} />
      </GlossaryProvider>
    );
    expect(results[0]).toBe(true);
    expect(results[1]).toBe(false);
  });

  it('다른 용어는 각자 독립적으로 첫 등장 추적', () => {
    const results: Record<string, boolean[]> = { 일주: [], 십신: [] };
    function MultiConsumer() {
      const { consume } = useGlossaryContext();
      results['일주'].push(consume('일주'));
      results['십신'].push(consume('십신'));
      results['일주'].push(consume('일주'));
      return null;
    }
    render(
      <GlossaryProvider>
        <MultiConsumer />
      </GlossaryProvider>
    );
    expect(results['일주'][0]).toBe(true);
    expect(results['십신'][0]).toBe(true);
    expect(results['일주'][1]).toBe(false);
  });

  it('Provider 외부에서 useGlossaryContext 호출 시 에러', () => {
    function NakedConsumer() {
      useGlossaryContext();
      return null;
    }
    expect(() => render(<NakedConsumer />)).toThrow();
  });
});
