import { defineConfig } from '@apps-in-toss/web-framework/config';

// granite 설정. appName='todaychemi' 콘솔 등록값 확정(2026-06-18).
export default defineConfig({
  appName: 'todaychemi', // 콘솔 등록 appName 확정 (딥링크 intoss://{appName} 영구 키)
  brand: {
    displayName: '오늘케미',
    primaryColor: '#FF91D5',
    // 앱 로고(twoday_app_logo_600.svg) — 우리 Vercel public 호스팅. 콘솔 업로드 이미지 URL로도 교체 가능.
    icon: 'https://todaychemi.vercel.app/apps-in-toss/twoday_app_logo_600.svg',
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
