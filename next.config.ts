import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import path from 'node:path';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {
    root: path.resolve(__dirname),
  },
  // 법적 문서(약관/개인정보/환불)는 런타임에 docs/legal/*.md 를 fs.readFile 로 읽는다.
  // Next 의 정적 트레이싱은 동적 fs 경로를 추적하지 못하므로, 해당 라우트의
  // 서버리스 번들에 .md 를 명시적으로 포함시켜야 Vercel 배포 후 500 이 나지 않는다.
  outputFileTracingIncludes: {
    '/legal/*': ['./docs/legal/*.md'],
    '/api/legal/documents/*': ['./docs/legal/*.md'],
  },
};

export default withNextIntl(nextConfig);
