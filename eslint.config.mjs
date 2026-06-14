import nextConfig from 'eslint-config-next/core-web-vitals';

const config = [
  {
    ignores: [
      'UIDesign/**',
      'coupleUnse-redesign/**',
      'miniapp/**',
    ],
  },
  ...nextConfig,
];

export default config;
