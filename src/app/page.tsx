import { redirect } from 'next/navigation';

// 루트 / → /app 으로 리다이렉트. middleware.ts 가 /app/** 보호 처리.
export default function RootPage() {
  redirect('/app');
}
