import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { itemName, itemPrice, dealType, userAShare, userBShare, userAVariant } = body;

    if (!itemName || !itemPrice) {
      return NextResponse.json(
        { error: 'Missing required lobby fields' },
        { status: 400, headers: corsHeaders }
      );
    }

    const priceNum = parseFloat(itemPrice);
    const hostShareNum = userAShare ? parseFloat(userAShare) : priceNum / 2;
    const partnerShareNum = userBShare ? parseFloat(userBShare) : priceNum / 2;

    const { data: lobby, error } = await supabase
      .from('lobbies')
      .insert([
        {
          item_name: itemName,
          item_price: priceNum,
          total_price: priceNum,
          deal_type: dealType || 'BOGO_FREE',
          user_a_share: hostShareNum,
          user_b_share: partnerShareNum,
          host_share: hostShareNum,
          partner_share: partnerShareNum,
          status: 'PENDING',
          user_a_variant: userAVariant || {},
          host_payment_intent_id: null,
          partner_payment_intent_id: null,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Supabase Lobby Creation Error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json({ lobbyId: lobby.id }, { headers: corsHeaders });
  } catch (err: any) {
    console.error('Create Lobby Route Error:', err.message);
    return NextResponse.json(
      { error: err.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
