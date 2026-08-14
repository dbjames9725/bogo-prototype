import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { itemPrice = 100 } = await req.json();

    const splitPrice = itemPrice / 2;           // $50.00
    const platformFee = (itemPrice * 0.05) / 2; // $2.50
    const stripeFee = 1.82;                     // $1.82 estimated card fee
    const totalUserChargeCents = Math.round((splitPrice + platformFee + stripeFee) * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalUserChargeCents,
      currency: 'usd',
      capture_method: 'manual',
    });

    const lobbyId = `bogo_${Math.random().toString(36).substring(2, 9)}`;
    const now = Date.now();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    const expiresAt = now + TWENTY_FOUR_HOURS;

    // Insert new lobby directly into Supabase
    const { error } = await supabase
      .from('lobbies')
      .insert({
        id: lobbyId,
        item_name: 'BOGO Offer Item',
        total_price: itemPrice,
        host_share: splitPrice,
        partner_share: splitPrice,
        host_payment_intent_id: paymentIntent.id,
        status: 'WAITING_FOR_PARTNER',
        created_at: new Date(now).toISOString(),
        expires_at: new Date(expiresAt).toISOString(),
      });

    if (error) {
      console.error('Supabase Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      lobbyId,
      clientSecret: paymentIntent.client_secret,
      chargeAmount: (totalUserChargeCents / 100).toFixed(2),
      expiresAt,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
