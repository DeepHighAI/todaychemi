import { redirect } from 'next/navigation';

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PaymentCheckoutPage({ searchParams }: Props) {
  const params = await searchParams;
  const orderId = readParam(params.orderId);
  redirect(orderId ? `/payments/charge?orderId=${encodeURIComponent(orderId)}` : '/payments/charge');
}

function readParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
