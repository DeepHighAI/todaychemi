import { TabBar } from '@/components/layout/tab-bar';

// 인증된 사용자 전용 레이아웃 — TabBar 고정 + main 하단 패딩으로 콘텐츠 가림 방지
// 미인증 보호는 middleware.ts 에서 처리
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="flex flex-col min-h-full pb-20">{children}</main>
      <TabBar />
    </>
  );
}
