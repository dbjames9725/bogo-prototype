import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { lobbyId } = await req.json();

    // 1. Fetch the lobby from Supabase
    const { data: lobby, error: fetchError } = await supabase
      .from('lobbies')
      .select('*')
      .eq('id', lobbyId)
      .single();

    if (fetchError || !lobby || lobby.status !== 'WAITING_FOR_PARTNER') {
      return NextResponse.json({ error: 'Lobby unavailable or expired' }, { status: 400 });
    }

    // Calculate Partner charge based on stored price shares
    const splitPrice = Number(lobby.partner_share);
    const platformFee = (Number(lobby.total_price) * 0.05) / 2;
    const stripeFee = 1.82;
    const totalUserChargeCents = Math.round((splitPrice + platformFee + stripeFee) * 100);

    // 2. Create Stripe PaymentIntent for User B
    const paymentIntentB = await stripe.paymentIntents.create({
      amount: totalUserChargeCents,
      currency: 'usd',
      capture_method: 'manual',
    });

    // 3. Update lobby record in Supabase with Partner payment intent ID
    const { error: updateError } = await supabase
      .from('lobbies')
      .update({
        partner_payment_intent_id: paymentIntentB.id,
      })
      .eq('id', lobbyId);

    if (updateError) {
      console.error('Supabase Update Error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      clientSecret: paymentIntentB.client_secret,
      chargeAmount: (totalUserChargeCents / 100).toFixed(2),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

