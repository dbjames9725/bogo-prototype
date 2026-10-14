import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const fetchedDeals = [
      {
        store_name: 'Shoe Carnival',
        store_logo: 'https://img.logo.dev/shoecarnival.com?token=pk_X-1A2B3C4D5E6F7G8H',
        deal_title: 'Always BOGO! Buy 1 Get 1 50% Off Footwear',
        affiliate_url: 'https://www.shoecarnival.com/bogof?subid=bogo_split',
        badge: 'ALWAYS BOGO',
      },
      {
        store_name: 'Aéropostale',
        store_logo: 'https://img.logo.dev/aeropostale.com?token=pk_X-1A2B3C4D5E6F7G8H',
        deal_title: 'Buy 1, Get 1 Free All Jeans',
        affiliate_url: 'https://www.aeropostale.com/women-teen-girls/features/b1g1/?subid=bogo_split',
        badge: 'BOGO FREE',
      },
      {
        store_name: 'Nike',
        store_logo: 'https://img.logo.dev/nike.com?token=pk_X-1A2B3C4D5E6F7G8H',
        deal_title: 'Mix & Match BOGO 50% Off Footwear',
        affiliate_url: 'https://www.nike.com/?subid=bogo_split',
        badge: 'BOGO 50%',
      },
      {
        store_name: 'Ulta Beauty',
        store_logo: 'https://img.logo.dev/ulta.com?token=pk_X-1A2B3C4D5E6F7G8H',
        deal_title: 'Buy 2 Get 1 Free Skincare Bundles',
        affiliate_url: 'https://www.ulta.com/?subid=bogo_split',
        badge: 'B2G1 FREE',
      },
    ];

    // Clear old deals and insert fresh offers into Supabase
    await supabase.from('store_deals').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    const { data, error } = await supabase.from('store_deals').insert(fetchedDeals).select();

    if (error) throw error;

    return NextResponse.json({ success: true, count: data.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
