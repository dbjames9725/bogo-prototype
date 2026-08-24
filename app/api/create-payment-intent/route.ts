import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { stripe } from '@/lib/stripe';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: Request) {
  try {
    const { lobbyId, role } = await req.json();

    if (!lobbyId || !role) {
      return NextResponse.json(
        { error: 'Missing required parameters: lobbyId or role' },
        { status: 400, headers: corsHeaders }
      );
    }

    // 1. Fetch authentic lobby record
    const { data: lobby, error } = await supabase
      .from('lobbies')
      .select('*')
      .eq('id', lobbyId)
      .single();

    if (error || !lobby) {
      return NextResponse.json(
        { error: 'Lobby record not found in database' },
        { status: 404, headers: corsHeaders }
      );
    }

    // 2. Perform authoritative fee calculation
    const originalPrice = lobby.item_price || 0;
    const baseShare = originalPrice / 2;
    const platformFee = originalPrice * 0.025; // 2.5% Platform Fee
    const stripeFee = baseShare * 0.029 + 0.30; // 2.9% + $0.30 Processing Fee
    const totalAmount = baseShare + platformFee + stripeFee;

    const amountInCents = Math.round(totalAmount * 100);

    if (amountInCents <= 0) {
      return NextResponse.json(
        { error: 'Invalid calculated payment amount' },
        { status: 400, headers: corsHeaders }
      );
    }

    // 3. Reuse existing intent if host or partner already initialized one
    const existingIntentId = role === 'HOST' ? lobby.host_payment_intent_id : lobby.partner_payment_intent_id;

    if (existingIntentId) {
      try {
        const existingIntent = await stripe.paymentIntents.retrieve(existingIntentId);
        if (existingIntent && existingIntent.status === 'requires_payment_method') {
          return NextResponse.json(
            {
              clientSecret: existingIntent.client_secret,
              paymentIntentId: existingIntent.id,
            },
            { headers: corsHeaders }
          );
        }
      } catch (retrieveErr) {
        console.warn('Could not retrieve existing PaymentIntent, creating new one.');
      }
    }

    // 4. Create new Stripe PaymentIntent if no valid existing intent is found
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      capture_method: 'manual',
      metadata: {
        lobbyId,
        role,
      },
    });

    return NextResponse.json(
      {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      },
      { headers: corsHeaders }
    );
  } catch (err: any) {
    console.error('Stripe Server Intent Error:', err.message);
    return NextResponse.json(
      { error: err.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
