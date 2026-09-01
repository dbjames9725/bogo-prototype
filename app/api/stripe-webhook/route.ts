import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { supabase } from '@/lib/supabase';

// Disable Next.js body parsing so Stripe can verify the raw request signature
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = await req.text();
  const headerList = await headers();
  const signature = headerList.get('stripe-signature');

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    console.error('Missing Stripe webhook signature or STRIPE_WEBHOOK_SECRET');
    return NextResponse.json(
      { error: 'Webhook secret or signature missing' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      // Triggered when a manual-capture PaymentIntent authorization succeeds (Hold placed)
      case 'payment_intent.amount_capturable_updated': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const { lobbyId } = paymentIntent.metadata || {};

        if (!lobbyId) {
          console.warn(`PaymentIntent ${paymentIntent.id} missing lobbyId metadata.`);
          break;
        }

        // Fetch current lobby state
        const { data: lobby, error } = await supabase
          .from('lobbies')
          .select('*')
          .eq('id', lobbyId)
          .single();

        if (error || !lobby) {
          console.error(`Lobby ${lobbyId} not found during webhook processing`);
          break;
        }

        // Check if both holds are present in DB and ready for capture
        if (
          lobby.status === 'PENDING' &&
          lobby.host_payment_intent_id &&
          lobby.partner_payment_intent_id
        ) {
          // Trigger internal match confirmation asynchronously
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          await fetch(`${baseUrl}/api/confirm-match`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lobbyId }),
          });
        }
        break;
      }

      // Triggered if a payment hold is canceled or expires (7-day Stripe hold limit)
      case 'payment_intent.canceled': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const { lobbyId } = paymentIntent.metadata || {};

        if (lobbyId) {
          console.log(`Hold canceled or expired for lobby ${lobbyId}. Marking lobby as EXPIRED.`);
          await supabase
            .from('lobbies')
            .update({ status: 'EXPIRED' })
            .eq('id', lobbyId);
        }
        break;
      }

      // Optional failure logger
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.warn(`Payment authorization failed for intent ${paymentIntent.id}: ${paymentIntent.last_payment_error?.message}`);
        break;
      }

      default:
        console.log(`Unhandled webhook event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error(`Error processing webhook event ${event.type}:`, err.message);
    return NextResponse.json(
      { error: 'Webhook handler processing failed' },
      { status: 500 }
    );
  }
}
