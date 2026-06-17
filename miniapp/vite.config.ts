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
});
