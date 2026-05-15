import nextConfig from 'eslint-config-next/core-web-vitals';

const config = [
  {
    ignores: [
      'UIDesign/**',
      'coupleUnse-redesign/**',
    ],
  },
  ...nextConfig,
];

export default config;
