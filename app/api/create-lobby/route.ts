import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Helper for CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Handle browser pre-flight checks (required for cross-site requests)
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: Request) {
  try {
    const { itemName, itemPrice, dealType, userAShare, userBShare } = await req.json();

    if (!itemName || !itemPrice || !userAShare || !userBShare) {
      return NextResponse.json(
        { error: 'Missing required lobby fields' },
        { status: 400, headers: corsHeaders }
      );
    }

    const priceNum = parseFloat(itemPrice);
    const hostShareNum = parseFloat(userAShare);
    const partnerShareNum = parseFloat(userBShare);

    // Insert populating both new and legacy column names
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
