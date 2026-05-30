import { NextRequest, NextResponse } from 'next/server';

import { apiErrorResponse } from '@/lib/errors/route-response';
import { getTossPaymentsClientKey } from '@/lib/payments/env';
import { getTossProduct } from '@/lib/payments/products';
import { createClient } from '@/lib/supabase/server';
import type { PaymentOrderResponse } from '@/types/wallet';

export async function GET(request: NextRequest) {
  try {
    const orderId = request.nextUrl.searchParams.get('orderId');
    if (!orderId) {
      return apiErrorResponse('INVALID_QUERY', 'orderId is required', 400);
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return apiErrorResponse('UNAUTHORIZED', '', 401);
    }

    const { data, error } = await supabase
      .from('payments')
      .select('payment_id,toss_order_id,toss_customer_key,product_id,amount_krw,token_amount,status')
      .eq('user_id', user.id)
      .eq('toss_order_id', orderId)
      .maybeSingle();

    if (error) {
      return apiErrorResponse('INTERNAL_ERROR', '', 500);
    }
    if (!data) {
      return apiErrorResponse('PAYMENT_NOT_FOUND', '결제 주문을 찾을 수 없습니다.', 404);
    }

    const product = data.product_id ? getTossProduct(data.product_id) : null;
    if (!product || data.amount_krw !== product.amount_krw || data.token_amount !== product.tokens) {
      return apiErrorResponse('PAYMENT_PRODUCT_MISMATCH', '주문 상품 정보가 올바르지 않습니다.', 400);
    }
    if (!data.toss_customer_key) {
      return apiErrorResponse('PAYMENT_CUSTOMER_KEY_MISSING', '결제 고객 식별자를 찾을 수 없습니다.', 400);
    }
    if (data.status === 'confirmed') {
      return apiErrorResponse('PAYMENT_ALREADY_CONFIRMED', '이미 완료된 결제 주문입니다.', 409);
    }
    if (!['pending', 'failed'].includes(data.status)) {
      return apiErrorResponse('PAYMENT_NOT_PAYABLE', '다시 결제할 수 없는 주문입니다.', 409);
    }

    const body: PaymentOrderResponse = {
      ok: true,
      order: {
        payment_id: data.payment_id,
        toss_order_id: data.toss_order_id,
        product_id: product.product_id,
        amount_krw: product.amount_krw,
        token_amount: product.tokens,
        order_name: product.order_name,
        status: data.status,
        client_key: getTossPaymentsClientKey(),
        customer_key: data.toss_customer_key,
      },
    };

    return NextResponse.json(body);
  } catch (err) {
    console.error('[/api/payments/order]', err);
    return apiErrorResponse('INTERNAL_ERROR', '', 500);
  }
}
