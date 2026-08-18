import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const {
      itemPrice,
      itemName = 'BOGO Offer Item',
      dealType = 'BOGO_FREE',
      userAAddress
    } = await req.json();

    const numericPrice = Number(itemPrice);
    if (!numericPrice || numericPrice <= 0) {
      return NextResponse.json({ error: 'Invalid item price' }, { status: 400 });
    }

    // Math:
    // BOGO_FREE: Cart Total = 1.0 * single item price (Each person pays 50% of single item price)
    // BOGO_50:   Cart Total = 1.5 * single item price (Each person pays 75% of single item price)
    const totalCartPrice = dealType === 'BOGO_50' ? numericPrice * 1.5 : numericPrice;
   
    // Split the promotion total equally between Host and Partner
    const splitPrice = totalCartPrice / 2;
    const platformFee = (totalCartPrice * 0.05) / 2;
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

    // Insert lobby record including deal_type and Host Return Address
    const { error } = await supabase
      .from('lobbies')
      .insert({
        id: lobbyId,
        item_name: itemName,
        total_price: totalCartPrice,
        host_share: splitPrice,
        partner_share: splitPrice,
        host_payment_intent_id: paymentIntent.id,
        user_a_address: userAAddress || null,
        deal_type: dealType,
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
      dealType,
      itemPrice: numericPrice.toFixed(2),
      chargeAmount: (totalUserChargeCents / 100).toFixed(2),
      clientSecret: paymentIntent.client_secret,
      expiresAt,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
