import { NextResponse } from 'next/server';
import { z } from 'zod';

import { apiErrorResponse } from '@/lib/errors/route-response';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { createTossCustomerKey, createTossOrderId } from '@/lib/payments/ids';
import { getTossProduct, TossProductIdSchema } from '@/lib/payments/products';
import type { PaymentInitResponse } from '@/types/wallet';

const PaymentInitSchema = z.object({
  product_id: TossProductIdSchema,
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = PaymentInitSchema.safeParse(json);
  if (!parsed.success) {
    return apiErrorResponse('INVALID_BODY', parsed.error.message, 400);
  }

  const product = getTossProduct(parsed.data.product_id);
  if (!product) {
    return apiErrorResponse('PRODUCT_NOT_FOUND', '상품을 찾을 수 없습니다.', 400);
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return apiErrorResponse('UNAUTHORIZED', '', 401);
  }

  const orderId = createTossOrderId();
  const customerKey = createTossCustomerKey();
  const service = createServiceRoleClient();
  const { data, error } = await service
    .from('payments')
    .insert({
      user_id: user.id,
      toss_order_id: orderId,
      toss_customer_key: customerKey,
      toss_payment_key: null,
      product_id: product.product_id,
      amount_krw: product.amount_krw,
      token_amount: product.tokens,
      status: 'pending',
      confirmed_at: null,
    })
    .select('payment_id,toss_order_id,toss_customer_key,product_id,amount_krw,token_amount,status')
    .single();

  if (error || !data) {
    return apiErrorResponse('INTERNAL_ERROR', '', 500);
  }

  const body: PaymentInitResponse = {
    ok: true,
    payment: {
      payment_id: data.payment_id,
      toss_order_id: data.toss_order_id,
      product_id: product.product_id,
      amount_krw: product.amount_krw,
      token_amount: product.tokens,
      order_name: product.order_name,
      status: data.status,
      customer_key: data.toss_customer_key ?? customerKey,
    },
  };

  return NextResponse.json(body, { status: 201 });
}
