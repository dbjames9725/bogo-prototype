import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { lobbyId } = await req.json();

    // 1. Fetch lobby from Supabase
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

    let paymentIntentId = lobby.partner_payment_intent_id;
    let paymentIntent;

    // 2. If User B already has a payment intent, fetch it. Otherwise create a new one.
    if (paymentIntentId) {
      paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    } else {
      paymentIntent = await stripe.paymentIntents.create({
        amount: totalUserChargeCents,
        currency: 'usd',
        capture_method: 'manual',
      });

      // Save User B's Payment Intent ID into Supabase
      const { error: updateError } = await supabase
        .from('lobbies')
        .update({ partner_payment_intent_id: paymentIntent.id })
        .eq('id', lobbyId);

      if (updateError) {
        console.error('Supabase Update Error:', updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      chargeAmount: (totalUserChargeCents / 100).toFixed(2),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

