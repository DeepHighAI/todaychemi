import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import aitDevtools from '@ait-co/devtools/unplugin';
import path from 'path';

// P0 호환성 스파이크용 Vite 설정.
// @/ 별칭 → src/ 루트 (웹앱 import 경로와 동일하게 유지)
// 앱인토스 devtools: 목 SDK alias + 플로팅 패널 자동 주입 (dev 전용, 프로덕션 빌드 자동 비활성).
export default defineConfig({
  plugins: [react(), aitDevtools.vite()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  // 로컬 테스트(dev 전용): /api/* 를 로컬 백엔드로 프록시 → 동일 오리진이라 CORS 불필요.
  // devtools 자체 엔드포인트(/api/ait-devtools/*)는 제외해 vite 가 직접 처리한다.
  // 백엔드 포트가 3001 이 아니면(보통 3000) target 을 맞춘다. server.proxy 는 프로덕션 빌드(.ait)에 영향 없음.
  server: {
    proxy: {
      '^/api/(?!ait-devtools)': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
