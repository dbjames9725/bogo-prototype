import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const shop_domain = body.shop_domain || 'bogo-test-sandbox.myshopify.com';
    const title = body.title;
    const buy_product_id = body.buy_product_id || body.triggerProductId;
    const buy_quantity = Number(body.buy_quantity || body.triggerQty) || 1;
    const get_product_id = body.get_product_id || body.rewardProductId;
    const get_quantity = Number(body.get_quantity || body.rewardQty) || 1;
    const discount_type = body.discount_type || 'percentage';
    const discount_value = Number(body.discount_value) || 100;

    if (!title || !buy_product_id || !get_product_id) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters: title, buy_product_id, or get_product_id.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('bogo_campaigns')
      .insert([
        {
          shop_domain,
          title,
          buy_product_id,
          buy_quantity,
          get_product_id,
          get_quantity,
          discount_type,
          discount_value,
          status: 'active',
        },
      ])
      .select();

    if (error) {
      console.error('Supabase error detail:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, campaign: data[0] });
  } catch (err: any) {
    console.error('API route catch:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const shop = searchParams.get('shop') || 'bogo-test-sandbox.myshopify.com';

    const { data, error } = await supabaseAdmin
      .from('bogo_campaigns')
      .select('*')
      .eq('shop_domain', shop)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, campaigns: data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
