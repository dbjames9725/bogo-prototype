import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    console.error('Missing stripe-signature or STRIPE_WEBHOOK_SECRET');
    return NextResponse.json({ error: 'Webhook configuration error' }, { status: 400 });
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // Handle successful hold authorization (amount_capturable_updated)
  if (event.type === 'payment_intent.amount_capturable_updated') {
    const paymentIntent = event.data.object;
    const { lobbyId, role } = paymentIntent.metadata || {};

    if (lobbyId) {
      console.log(`Webhook received hold authorization for Lobby ID: ${lobbyId} (${role})`);

      // 1. Query the current state of the lobby from Supabase
      const { data: lobby, error } = await supabase
        .from('lobbies')
        .select('*')
        .eq('id', lobbyId)
        .single();

      if (error || !lobby) {
        console.error('Webhook: Lobby not found in Supabase:', lobbyId);
        return NextResponse.json({ received: true });
      }

      // 2. Check if both holds are present and ready to capture
      const hostHoldId = role === 'HOST' ? paymentIntent.id : lobby.host_payment_intent_id;
      const partnerHoldId = role === 'PARTNER' ? paymentIntent.id : lobby.partner_payment_intent_id;

      if (hostHoldId && partnerHoldId && lobby.status !== 'MATCHED') {
        try {
          // Simultaneous dual capture
          await Promise.all([
            stripe.paymentIntents.capture(hostHoldId),
            stripe.paymentIntents.capture(partnerHoldId),
          ]);

          // Update lobby status in Supabase to MATCHED
          await supabase
            .from('lobbies')
            .update({ status: 'MATCHED' })
            .eq('id', lobbyId);

          console.log(`🎉 Webhook successfully captured dual holds for Lobby ID: ${lobbyId}`);
        } catch (captureErr: any) {
          console.error('Webhook Capture Error:', captureErr.message);
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}