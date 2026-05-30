import Link from 'next/link';
import { CheckCircle2, Sparkles } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PaymentsSuccessPage({ searchParams }: Props) {
  const params = await searchParams;
  const orderId = readParam(params.orderId);

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <section className="mx-auto max-w-md rounded-[var(--r-md)] border border-[var(--hairline)] bg-card p-5 text-center shadow-[var(--e-1)]">
        <div className="mx-auto flex size-14 items-center justify-center rounded-[18px] bg-primary text-primary-foreground">
          <CheckCircle2 size={30} />
        </div>
        <p className="mt-4 text-sm font-semibold text-primary">부적 충전 완료</p>
        <h1 className="mt-2 text-2xl font-extrabold text-foreground">지갑에 반영됐어요</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          결제 확인이 끝났습니다. 같은 결제 링크가 다시 호출돼도 부적은 한 번만 지급됩니다.
        </p>
        {orderId && (
          <p className="mt-3 rounded-[var(--r-sm)] bg-[var(--surface-2)] px-3 py-2 text-xs font-semibold text-muted-foreground">
            주문번호 {orderId}
          </p>
        )}
        <div className="mt-5 flex gap-2">
          <Link href="/payments/charge" className={cn(buttonVariants({ variant: 'outline' }), 'flex-1')}>
            <Sparkles size={17} />
            더 충전
          </Link>
          <Link href="/me" className={cn(buttonVariants(), 'flex-1')}>
            내 사주맵
          </Link>
        </div>
      </section>
    </main>
  );
}

function readParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
