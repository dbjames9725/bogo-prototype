import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
  try {
    // 1. Verify Authorization Header (Security Check for Vercel Cron)
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date().toISOString();

    // 2. Fetch lobbies that are past expiration and still waiting for a partner
    const { data: expiredLobbies, error: fetchError } = await supabase
      .from('lobbies')
      .select('*')
      .eq('status', 'WAITING_FOR_PARTNER')
      .lt('expires_at', now);

    if (fetchError) {
      console.error('Failed to fetch expired lobbies:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!expiredLobbies || expiredLobbies.length === 0) {
      return NextResponse.json({ message: 'No expired lobbies found' });
    }

    const results = [];

    // 3. Process each expired lobby: Cancel Stripe hold and update status
    for (const lobby of expiredLobbies) {
      try {
        // Cancel Host PaymentIntent hold in Stripe
        if (lobby.host_payment_intent_id) {
          await stripe.paymentIntents.cancel(lobby.host_payment_intent_id);
        }

        // Cancel Partner PaymentIntent hold if one exists
        if (lobby.partner_payment_intent_id) {
          await stripe.paymentIntents.cancel(lobby.partner_payment_intent_id);
        }

        // Update database record status
        await supabase
          .from('lobbies')
          .update({ status: 'EXPIRED' })
          .eq('id', lobby.id);

        results.push({ id: lobby.id, status: 'EXPIRED_AND_RELEASED' });
      } catch (err: any) {
        console.error(`Error expiring lobby ${lobby.id}:`, err);
        results.push({ id: lobby.id, error: err.message });
      }
    }

    return NextResponse.json({ processed: results.length, details: results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
