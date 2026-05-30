import { redirect } from 'next/navigation';

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PaymentFailPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = buildQuery(params);
  redirect(query ? `/payments/fail?${query}` : '/payments/fail');
}

function buildQuery(params: Record<string, string | string[] | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        query.append(key, item);
      }
    } else if (value) {
      query.set(key, value);
    }
  }
  return query.toString();
}
