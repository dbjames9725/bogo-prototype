import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { supabase } from '@/lib/supabase';

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
      // Triggered when a manual-capture PaymentIntent hold is successfully placed
      case 'payment_intent.amount_capturable_updated': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const { lobbyId, role } = paymentIntent.metadata || {};

        if (!lobbyId) {
          console.warn(`PaymentIntent ${paymentIntent.id} missing lobbyId metadata.`);
          break;
        }

        // 1. Assign Payment Intent ID to DB based on participant role
        const updateField =
          role?.toUpperCase() === 'HOST'
            ? { host_payment_intent_id: paymentIntent.id }
            : { partner_payment_intent_id: paymentIntent.id };

        const { data: updatedLobby, error: updateError } = await supabase
          .from('lobbies')
          .update(updateField)
          .eq('id', lobbyId)
          .select('*')
          .single();

        if (updateError || !updatedLobby) {
          console.error(`Failed updating lobby ${lobbyId} with payment intent ID:`, updateError);
          break;
        }

        // 2. Check if BOTH holds are now present in DB & trigger match
        if (
          updatedLobby.status === 'PENDING' &&
          updatedLobby.host_payment_intent_id &&
          updatedLobby.partner_payment_intent_id
        ) {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          await fetch(`${baseUrl}/api/confirm-match`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lobbyId }),
          });
        }
        break;
      }

      // Triggered if a hold is canceled or expires after 7 days
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
