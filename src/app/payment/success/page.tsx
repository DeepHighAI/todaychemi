import Link from 'next/link';
import { redirect } from 'next/navigation';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/server';
import { confirmPaymentForUser, PaymentFlowError } from '@/lib/payments/complete';
import { TossPaymentError } from '@/lib/payments/toss-server';

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PaymentSuccessPage({ searchParams }: Props) {
  const params = await searchParams;
  const paymentKey = readParam(params.paymentKey);
  const orderId = readParam(params.orderId);
  const amountText = readParam(params.amount);
  const amount = Number(amountText);

  if (!paymentKey || !orderId || !Number.isFinite(amount)) {
    return <PaymentResultError message="결제 승인 정보가 올바르지 않습니다." />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return <PaymentResultError message="로그인이 필요합니다. 다시 로그인 후 결제를 확인해주세요." />;
  }

  try {
    await confirmPaymentForUser({
      userId: user.id,
      orderId,
      paymentKey,
      amount,
    });
  } catch (err) {
    const code = err instanceof TossPaymentError || err instanceof PaymentFlowError
      ? err.code
      : 'PAYMENT_CONFIRM_FAILED';
    const message = err instanceof Error ? err.message : '결제 승인에 실패했습니다.';
    redirect(`/payment/fail?orderId=${encodeURIComponent(orderId)}&code=${encodeURIComponent(code)}&message=${encodeURIComponent(message)}`);
  }

  redirect('/me?payment=success');
}

function PaymentResultError({ message }: { message: string }) {
  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <section className="mx-auto max-w-md rounded-[var(--r-md)] bg-card p-5 text-center">
        <h1 className="text-xl font-extrabold text-foreground">결제 확인이 필요해요</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{message}</p>
        <Link href="/me" className={cn(buttonVariants(), 'mt-5 w-full')}>
          내 사주맵으로 돌아가기
        </Link>
      </section>
    </main>
  );
}

function readParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
