import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('public share page cache contract', () => {
  it('uses the request-level cached share lookup for metadata and page render', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/app/h/[token]/page.tsx'),
      'utf8',
    );

    expect(source).toContain('getCachedPublicShareByToken');
    expect(source).not.toContain("import { getPublicShareByToken }");
    expect(source.match(/getCachedPublicShareByToken\(token\)/g)).toHaveLength(2);
  });
});
