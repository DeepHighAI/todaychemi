import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// P0 호환성 스파이크용 최소 Vite 설정. (P2에서 granite.config.ts 가 빌드를 감싸도록 전환)
export default defineConfig({
  plugins: [react()],
});
