import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// P0 호환성 스파이크용 Vite 설정.
// @/ 별칭 → src/ 루트 (웹앱 import 경로와 동일하게 유지)
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
