/**
 * main.tsx — 앱 진입점
 *
 * 마운트 순서:
 *   QueryClientProvider (TanStack Query 서버 상태)
 *   └── NextIntlClientProvider (i18n — 한국어)
 *       └── AuthProvider (Bearer 토큰 세션)
 *           └── AppRouter (HashRouter + 페이지들)
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import { App } from './App';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root 엘리먼트를 찾을 수 없습니다');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
