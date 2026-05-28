import { ConditionalTabBar } from '@/components/layout/conditional-tab-bar';
import { FreeTalismanRewardGate } from '@/components/rewards/free-talisman-reward-gate';
import { WelcomePopup } from '@/components/welcome/welcome-popup';

// 인증된 사용자 전용 레이아웃 — TabBar 고정 + main 하단 패딩으로 콘텐츠 가림 방지
// 미인증 진입은 각 route/API guard에서 처리한다.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <FreeTalismanRewardGate />
      <WelcomePopup />
      <main className="flex flex-col min-h-full pb-20">{children}</main>
      <ConditionalTabBar />
    </>
  );
}
