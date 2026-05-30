import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';
import { markPaymentFailedForUser } from '@/lib/payments/complete';
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PaymentsFailPage({ searchParams }: Props) {
  const params = await searchParams;
  const orderId = readParam(params.orderId);
  const code = readParam(params.code) ?? 'PAYMENT_FAILED';
  const message = readParam(params.message) ?? '결제를 완료하지 못했습니다.';

  if (orderId && shouldMarkPaymentFailed(code)) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await markPaymentFailedForUser({ userId: user.id, orderId, code, message });
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <section className="mx-auto max-w-md rounded-[var(--r-md)] border border-[var(--hairline)] bg-card p-5 shadow-[var(--e-1)]">
        <p className="text-sm font-semibold text-destructive">{code}</p>
        <h1 className="mt-2 text-xl font-extrabold text-foreground">결제가 완료되지 않았어요</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{message}</p>
        {orderId && (
          <p className="mt-3 rounded-[var(--r-sm)] bg-[var(--surface-2)] px-3 py-2 text-xs font-semibold text-muted-foreground">
            주문번호 {orderId}
          </p>
        )}
        <div className="mt-5 flex gap-2">
          <Link href="/me" className={cn(buttonVariants({ variant: 'outline' }), 'flex-1')}>
            내 사주맵
          </Link>
          <Link href="/payments/charge" className={cn(buttonVariants(), 'flex-1')}>
            다시 충전
          </Link>
        </div>
      </section>
    </main>
  );
}

function shouldMarkPaymentFailed(code: string): boolean {
  return !['PAYMENT_CONFIRM_RETRYABLE', 'PAYMENT_CONFIRM_RPC_FAILED'].includes(code);
}

function readParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
