import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { lobbyId, userBAddress } = await req.json();

    if (!lobbyId) {
      return NextResponse.json({ error: 'Missing lobbyId' }, { status: 400 });
    }

    // 1. Fetch lobby record from Supabase
    const { data: lobby, error: fetchError } = await supabase
      .from('lobbies')
      .select('*')
      .eq('id', lobbyId)
      .single();

    if (fetchError || !lobby) {
      return NextResponse.json({ error: 'Lobby not found' }, { status: 404 });
    }

    const itemPrice = Number(lobby.total_price);
    const splitPrice = itemPrice / 2;
    const platformFee = (itemPrice * 0.05) / 2;
    const stripeFee = 1.82;
    const totalUserChargeCents = Math.round((splitPrice + platformFee + stripeFee) * 100);

    // 2. Create a fresh Payment Intent for User B
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalUserChargeCents,
      currency: 'usd',
      capture_method: 'manual',
    });

    // 3. Update lobby with User B PaymentIntent ID and Shipping Address
    const { error: updateError } = await supabase
      .from('lobbies')
      .update({
        partner_payment_intent_id: paymentIntent.id,
        user_b_address: userBAddress || null,
      })
      .eq('id', lobbyId);

    if (updateError) {
      console.error('Supabase Update Error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      chargeAmount: (totalUserChargeCents / 100).toFixed(2),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
