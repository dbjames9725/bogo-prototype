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

    // 1. Retrieve lobby record from Supabase
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

    // 2. Check if an intent ID already exists for this role
    const existingIntentId = role === 'HOST' ? lobby.host_payment_intent_id : lobby.partner_payment_intent_id;

    if (existingIntentId) {
      try {
        const existingIntent = await stripe.paymentIntents.retrieve(existingIntentId);
        if (existingIntent && (existingIntent.status === 'requires_payment_method' || existingIntent.status === 'requires_capture')) {
          return NextResponse.json(
            {
              clientSecret: existingIntent.client_secret,
              paymentIntentId: existingIntent.id,
            },
            { headers: corsHeaders }
          );
        }
      } catch (e) {
        console.warn('Could not retrieve existing PaymentIntent, creating new one.');
      }
    }

    // 3. Perform authoritative server-side fee calculation
    const originalPrice = lobby.item_price || 0;
    const baseShare = originalPrice / 2;
    const platformFee = originalPrice * 0.025; // 2.5% Platform Fee
    const stripeFee = baseShare * 0.029 + 0.30; // 2.9% + $0.30 Processing Fee
    const totalAmount = baseShare + platformFee + stripeFee;

    const amountInCents = Math.round(totalAmount * 100);

    // 4. Create new Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      capture_method: 'manual',
      metadata: { lobbyId, role },
    });

    // 5. CRITICAL FIX: Save Intent ID to Supabase IMMEDIATELY upon creation
    const updateColumn = role === 'HOST'
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