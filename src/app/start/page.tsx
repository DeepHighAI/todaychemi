import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Sparkles, UserRound } from 'lucide-react';

import { createClient } from '@/lib/supabase/server';

export default async function StartPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect('/');

  return (
    <main className="min-h-screen bg-background px-5 py-8">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center gap-8">
        <div className="space-y-3">
          <p className="font-eyebrow text-primary">오늘케미</p>
          <h1 className="text-3xl font-black leading-tight text-foreground">
            오늘의 나를 먼저 보고,
            <br />
            우리 사이를 이어볼게요.
          </h1>
          <p className="font-sub text-muted-foreground">
            회원가입 전에도 내 오늘 흐름을 가볍게 확인할 수 있어요.
            친구와의 오늘 케미를 보려면 그때 계정을 만들면 됩니다.
          </p>
        </div>

        <div className="space-y-3">
          <Link
            href="/guest/start"
            className="flex min-h-16 items-center gap-3 rounded-[var(--r-md)] bg-primary px-4 text-primary-foreground shadow-sm transition active:scale-[0.99]"
          >
            <span className="flex size-11 items-center justify-center rounded-[14px] bg-white/20">
              <Sparkles size={22} />
            </span>
            <span className="flex-1">
              <span className="block text-base font-black">처음이세요?</span>
              <span className="block text-xs opacity-85">가입 전 내 오늘 흐름 먼저 보기</span>
            </span>
          </Link>

          <Link
            href="/login"
            className="flex min-h-16 items-center gap-3 rounded-[var(--r-md)] border border-border bg-card px-4 text-foreground transition active:scale-[0.99]"
          >
            <span className="flex size-11 items-center justify-center rounded-[14px] bg-[var(--surface-1)] text-primary">
              <UserRound size={22} />
            </span>
            <span className="flex-1">
              <span className="block text-base font-black">우리 만난 적 있죠?</span>
              <span className="block text-xs text-muted-foreground">기존 계정으로 바로 로그인</span>
            </span>
          </Link>
        </div>
      </section>
    </main>
  );
}
