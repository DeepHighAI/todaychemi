// 인증된 사용자 전용 레이아웃 — TabBar 추후 구현 (S-04 이후)
// 미인증 보호는 middleware.ts 에서 처리
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col min-h-full">{children}</div>;
}
