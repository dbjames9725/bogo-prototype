import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
  try {
    // 1. Calculate time threshold (24 hours ago)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // 2. Query PENDING lobbies older than 24 hours
    const { data: expiredLobbies, error: fetchError } = await supabase
      .from('lobbies')
      .select('*')
      .eq('status', 'PENDING')
      .lt('created_at', twentyFourHoursAgo);

    if (fetchError) {
      console.error('Error fetching expired lobbies:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!expiredLobbies || expiredLobbies.length === 0) {
      return NextResponse.json({ message: 'No expired lobbies found.' });
    }

    // 3. Process each expired lobby: Cancel Stripe payment hold & update status
    const processedIds: string[] = [];

    for (const lobby of expiredLobbies) {
      // Cancel host's payment authorization hold if present
      if (lobby.host_payment_intent_id) {
        try {
          await stripe.paymentIntents.cancel(lobby.host_payment_intent_id);
        } catch (stripeErr: any) {
          console.error(`Failed to cancel Stripe hold for lobby ${lobby.id}:`, stripeErr.message);
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
  } catch (err: any) {
    console.error('Expire Lobbies Route Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
