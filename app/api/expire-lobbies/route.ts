import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function GET() {
  try {
    // 1. Calculate time threshold (15 minutes ago)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    // 2. Query PENDING lobbies created over 15 minutes ago
    const { data: expiredLobbies, error: fetchError } = await supabase
      .from('lobbies')
      .select('*')
      .eq('status', 'PENDING')
      .lt('created_at', fifteenMinutesAgo);

    if (fetchError) {
      console.error('Error fetching expired lobbies:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!expiredLobbies || expiredLobbies.length === 0) {
      return NextResponse.json({ message: 'No expired lobbies found.' });
    }

    // 3. Process each expired lobby: Cancel Stripe payment holds & update status
    const processedIds: string[] = [];

    for (const lobby of expiredLobbies) {
      // Cancel Host payment authorization hold if present
      if (lobby.host_payment_intent_id) {
        try {
          await stripe.paymentIntents.cancel(lobby.host_payment_intent_id);
        } catch (stripeErr) {
          const e = stripeErr as Error;
          console.error(`Failed to cancel Host hold for lobby ${lobby.id}:`, e.message);
        }
      }

      // Cancel Partner payment authorization hold if present
      if (lobby.partner_payment_intent_id) {
        try {
          await stripe.paymentIntents.cancel(lobby.partner_payment_intent_id);
        } catch (stripeErr) {
          const e = stripeErr as Error;
          console.error(`Failed to cancel Partner hold for lobby ${lobby.id}:`, e.message);
        }
      }

      // Mark lobby status as EXPIRED in Supabase
      const { error: updateError } = await supabase
        .from('lobbies')
        .update({ status: 'EXPIRED' })
        .eq('id', lobby.id);

      if (!updateError) {
        processedIds.push(lobby.id);
      }
    }

    return NextResponse.json({
      success: true,
      expiredCount: processedIds.length,
      expiredLobbyIds: processedIds,
    });
  } catch (err) {
    const e = err as Error;
    console.error('Expire Lobbies Route Error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

