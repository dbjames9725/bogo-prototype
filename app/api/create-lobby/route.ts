import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { itemPrice, itemName = 'BOGO Offer Item', userAAddress } = await req.json();

    const numericPrice = Number(itemPrice);
    if (!numericPrice || numericPrice <= 0) {
      return NextResponse.json({ error: 'Invalid item price' }, { status: 400 });
    }

    const splitPrice = numericPrice / 2;
    const platformFee = (numericPrice * 0.05) / 2;
    const stripeFee = 1.82;
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

    // Insert lobby record including Host Return Address
    const { error } = await supabase
      .from('lobbies')
      .insert({
        id: lobbyId,
        item_name: itemName,
        total_price: numericPrice,
        host_share: splitPrice,
        partner_share: splitPrice,
        host_payment_intent_id: paymentIntent.id,
        user_a_address: userAAddress || null,
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
      itemName,
      itemPrice: numericPrice.toFixed(2),
      clientSecret: paymentIntent.client_secret,
      chargeAmount: (totalUserChargeCents / 100).toFixed(2),
      expiresAt,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
