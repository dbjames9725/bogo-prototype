import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { getLobbies, saveLobbies } from '@/lib/lobbies';

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

    const lobbies = getLobbies();
    lobbies[lobbyId] = {
      id: lobbyId,
      itemPrice,
      userA: {
        paymentIntentId: paymentIntent.id,
        chargeAmount: totalUserChargeCents / 100,
      },
      status: 'WAITING_FOR_PARTNER',
      createdAt: now,
      expiresAt: now + TWENTY_FOUR_HOURS, // Set 24-hour expiration
    };
    saveLobbies(lobbies);

    return NextResponse.json({
      lobbyId,
      clientSecret: paymentIntent.client_secret,
      chargeAmount: (totalUserChargeCents / 100).toFixed(2),
      expiresAt: lobbies[lobbyId].expiresAt,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
