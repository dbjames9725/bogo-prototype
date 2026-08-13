import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { getLobbies, saveLobbies } from '@/lib/lobbies';

export async function POST(req: Request) {
  try {
    const { lobbyId } = await req.json();
    const lobbies = getLobbies();
    const lobby = lobbies[lobbyId];

    if (!lobby || lobby.status !== 'WAITING_FOR_PARTNER') {
      return NextResponse.json({ error: 'Lobby unavailable or expired' }, { status: 400 });
    }

    const totalUserChargeCents = Math.round(lobby.userA.chargeAmount * 100);

    const paymentIntentB = await stripe.paymentIntents.create({
      amount: totalUserChargeCents,
      currency: 'usd',
      capture_method: 'manual',
    });

    lobby.userB = {
      paymentIntentId: paymentIntentB.id,
      chargeAmount: totalUserChargeCents / 100,
    };

    lobbies[lobbyId] = lobby;
    saveLobbies(lobbies);

    return NextResponse.json({
      clientSecret: paymentIntentB.client_secret,
      chargeAmount: (totalUserChargeCents / 100).toFixed(2),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
