import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const shop = searchParams.get('shop');
  const productId = searchParams.get('product_id');

  if (!shop || !productId) {
    return NextResponse.json({ success: false, error: 'Missing shop or product_id' }, { status: 400 });
  }

  // Fetch active campaigns matching the product ID
  const { data: campaigns, error } = await supabaseAdmin
    .from('bogo_campaigns')
    .select('*')
    .eq('shop_domain', shop)
    .eq('status', 'active')
    .or(`buy_product_id.eq.${productId},buy_product_id.eq.gid://shopify/Product/${productId}`);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { success: true, campaigns: campaigns || [] },
    {
      headers: {
        'Access-Control-Allow-Origin': '*', // Enable CORS for storefront fetches
        'Access-Control-Allow-Methods': 'GET',
      },
    }
  );
}
