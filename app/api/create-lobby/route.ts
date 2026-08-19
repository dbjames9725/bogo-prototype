import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { itemName, itemPrice, dealType, userAShare, userBShare } = await req.json();

    if (!itemName || !itemPrice || !userAShare || !userBShare) {
      return NextResponse.json({ error: 'Missing required lobby fields' }, { status: 400 });
    }

    const priceNum = parseFloat(itemPrice);

    // Insert new lobby populating both item_price and total_price to satisfy legacy schemas
    const { data: lobby, error } = await supabase
      .from('lobbies')
      .insert([
        {
          item_name: itemName,
          item_price: priceNum,
          total_price: priceNum, // Keeps legacy column satisfied
          deal_type: dealType || 'BOGO_FREE',
          user_a_share: parseFloat(userAShare),
          user_b_share: parseFloat(userBShare),
          status: 'PENDING',
          host_payment_intent_id: null,
          partner_payment_intent_id: null,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Supabase Lobby Creation Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ lobbyId: lobby.id });
  } catch (err: any) {
    console.error('Create Lobby Route Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}