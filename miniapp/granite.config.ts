import { defineConfig } from '@apps-in-toss/web-framework/config';

// P0 호환성 스파이크용 granite 설정. appName/brand 는 P1에서 콘솔 등록값으로 확정.
export default defineConfig({
  appName: 'todaychemi', // 콘솔 appName 확정 시 교체 (딥링크 intoss://{appName} 영구 키)
  brand: {
    displayName: '오늘케미',
    primaryColor: '#FF91D5',
    icon: '', // 콘솔 업로드 이미지 URL
  },
  web: {
    host: 'localhost',
    port: 5173,
    commands: {
      dev: 'vite dev',
      build: 'vite build',
    },
  },
  permissions: [],
  outdir: 'dist',
});
