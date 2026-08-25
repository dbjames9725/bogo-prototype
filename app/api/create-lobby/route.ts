import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { stripe } from '@/lib/stripe';

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
    const baseShare = priceNum / 2;
    const platformFee = priceNum * 0.025;
    const stripeFee = baseShare * 0.029 + 0.30;
    const totalAmount = baseShare + platformFee + stripeFee;
    const amountInCents = Math.round(totalAmount * 100);

    // 1. Create Host PaymentIntent immediately on Stripe
    const hostPaymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      capture_method: 'manual',
      metadata: { role: 'HOST' },
    });

    // 2. Insert lobby record into Supabase with pre-attached host_payment_intent_id
    const { data: lobby, error } = await supabase
      .from('lobbies')
      .insert([
        {
          item_name: itemName,
          item_price: priceNum,
          total_price: priceNum,
          deal_type: dealType || 'BOGO_FREE',
          user_a_share: baseShare,
          user_b_share: baseShare,
          host_share: baseShare,
          partner_share: baseShare,
          status: 'PENDING',
          user_a_variant: userAVariant || {},
          host_payment_intent_id: hostPaymentIntent.id,
          partner_payment_intent_id: null,
        },
      ])
      .select()
      .single();

    if (error || !lobby) {
      console.error('Supabase Lobby Creation Error:', error);
      return NextResponse.json(
        { error: error ? error.message : 'Failed creating lobby' },
        { status: 500, headers: corsHeaders }
      );
    }

    // 3. Update Stripe intent metadata with lobby ID
    await stripe.paymentIntents.update(hostPaymentIntent.id, {
      metadata: { lobbyId: lobby.id, role: 'HOST' },
    });

    return NextResponse.json({ lobbyId: lobby.id }, { headers: corsHeaders });
  } catch (err: any) {
    console.error('Create Lobby Route Error:', err.message);
    return NextResponse.json(
      { error: err.message },
      { status: 500, headers: corsHeaders }
    );
  }
}

