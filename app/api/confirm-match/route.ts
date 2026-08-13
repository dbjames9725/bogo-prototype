import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { getLobbies, saveLobbies } from '@/lib/lobbies';

export async function POST(req: Request) {
  try {
    const { lobbyId } = await req.json();
    const lobbies = getLobbies();
    const lobby = lobbies[lobbyId];

    if (!lobby || !lobby.userA?.paymentIntentId || !lobby.userB?.paymentIntentId) {
      return NextResponse.json({ error: 'Invalid lobby state' }, { status: 400 });
    }

    await Promise.all([
      stripe.paymentIntents.capture(lobby.userA.paymentIntentId),
      stripe.paymentIntents.capture(lobby.userB.paymentIntentId),
    ]);

    lobby.status = 'COMPLETED';
    lobbies[lobbyId] = lobby;
    saveLobbies(lobbies);

    return NextResponse.json({ success: true, status: 'COMPLETED' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
