import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// 미니앱 단위/컴포넌트 테스트 설정.
// vite.config.ts 와 분리한다(aitDevtools 목 SDK 주입은 테스트에 불필요·간섭 소지).
// 컴포넌트가 대부분이라 jsdom 을 전역 환경으로 둔다.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    testTimeout: 15000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
