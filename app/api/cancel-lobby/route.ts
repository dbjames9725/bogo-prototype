import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { getLobbies, saveLobbies } from '@/lib/lobbies';

export async function POST(req: Request) {
  try {
    const { lobbyId } = await req.json();
    const lobbies = getLobbies();
    const lobby = lobbies[lobbyId];

    if (!lobby) {
      return NextResponse.json({ error: 'Lobby not found' }, { status: 404 });
    }

    if (lobby.status !== 'WAITING_FOR_PARTNER') {
      return NextResponse.json({ error: 'Lobby cannot be cancelled in current state' }, { status: 400 });
    }

    // Cancel Stripe payment intent to release User A's card hold
    await stripe.paymentIntents.cancel(lobby.userA.paymentIntentId);

    lobby.status = 'CANCELLED';
    lobbies[lobbyId] = lobby;
    saveLobbies(lobbies);

    return NextResponse.json({ success: true, status: 'CANCELLED' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
