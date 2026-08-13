import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { getLobbies, saveLobbies } from '@/lib/lobbies';

export async function GET() {
  try {
    const lobbies = getLobbies();
    const now = Date.now();
    let cancelledCount = 0;

    for (const [id, lobby] of Object.entries(lobbies)) {
      if (lobby.status === 'WAITING_FOR_PARTNER' && now >= lobby.expiresAt) {
        try {
          // Release User A's held funds in Stripe
          await stripe.paymentIntents.cancel(lobby.userA.paymentIntentId);
          lobby.status = 'CANCELLED';
          lobbies[id] = lobby;
          cancelledCount++;
        } catch (e) {
          console.error(`Failed to cancel payment for lobby ${id}:`, e);
        }
      }
    }

    if (cancelledCount > 0) {
      saveLobbies(lobbies);
    }

    return NextResponse.json({ success: true, cancelledCount });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
