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

    const isHost = role === 'HOST';
    const existingIntentId = isHost ? lobby.host_payment_intent_id : lobby.partner_payment_intent_id;

    if (existingIntentId) {
      try {
        const existingIntent = await stripe.paymentIntents.retrieve(existingIntentId);
        if (
          existingIntent &&
          (existingIntent.status === 'requires_payment_method' || existingIntent.status === 'requires_capture')
        ) {
          return NextResponse.json(
            {
              clientSecret: existingIntent.client_secret,
              paymentIntentId: existingIntent.id,
            },
            { headers: corsHeaders }
          );
        }
      } catch (e) {
        console.warn('Could not retrieve existing PaymentIntent, creating a new one.');
      }
    }

    // Convert original price to cents first to prevent floating-point precision errors
    const itemPriceCents = Math.round((lobby.item_price || 0) * 100);

    // Split base share in cents
    const baseShareCents = Math.round(itemPriceCents / 2);

    // Calculate 2.5% platform fee strictly on the INDIVIDUAL share (fixes double fee bug)
    const platformFeeCents = Math.round(baseShareCents * 0.025);

    // Calculate Stripe processing fee (2.9% + 30 cents)
    const stripeFeeCents = Math.round(baseShareCents * 0.029 + 30);

    // Sum total amount directly in integer cents
    const amountInCents = baseShareCents + platformFeeCents + stripeFeeCents;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      capture_method: 'manual',
      metadata: { lobbyId, role },
    });

    const updateColumn = isHost
      ? { host_payment_intent_id: paymentIntent.id }
      : { partner_payment_intent_id: paymentIntent.id };

    await supabase.from('lobbies').update(updateColumn).eq('id', lobbyId);

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
