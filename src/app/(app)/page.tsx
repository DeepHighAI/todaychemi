import { redirect } from 'next/navigation';

// /app 진입점 → /feed 로 리다이렉트
export default function AppPage() {
  redirect('/feed');
}
