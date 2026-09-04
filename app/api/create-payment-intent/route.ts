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

    // Fetch the lobby record
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

    // 1. Check if this role ALREADY completed their payment hold
    const existingIntentId = isHost ? lobby.host_payment_intent_id : lobby.partner_payment_intent_id;

    if (existingIntentId) {
      try {
        const existingIntent = await stripe.paymentIntents.retrieve(existingIntentId);
        // If it's already authorized/succeeded, don't re-confirm it!
        if (existingIntent.status === 'requires_capture' || existingIntent.status === 'succeeded') {
          return NextResponse.json(
            { error: `${role} payment hold has already been authorized.` },
            { status: 400, headers: corsHeaders }
          );
        }
      } catch (e) {
        // If retrieval fails, proceed to create a new one
      }
    }

    // 2. Calculate accurate amounts in integer cents
    const itemPrice = Number(lobby.item_price) || 0;
    const itemPriceCents = Math.round(itemPrice * 100);

    const dealType = (lobby.deal_type || 'BOGO').toUpperCase();
    const isBogo50 = dealType === 'BOGO_50' || dealType === 'BUY_1_GET_1_50_OFF';

    const bogoPromoTotalCents = isBogo50 ? Math.round(itemPriceCents * 1.5) : itemPriceCents;
    const baseShareCents = Math.round(bogoPromoTotalCents / 2);

    const totalPlatformFeeCents = Math.round(itemPriceCents * 0.05);
    const platformFeeCents = Math.round(totalPlatformFeeCents / 2);

    const stripeFeeCents = Math.round(baseShareCents * 0.029 + 30);

    const totalAmountCents = Math.round(baseShareCents + platformFeeCents + stripeFeeCents);
    const validAmountCents = Math.max(50, totalAmountCents);

    // 3. ALWAYS create a BRAND NEW PaymentIntent dedicated to this specific role
    const paymentIntent = await stripe.paymentIntents.create({
      amount: validAmountCents,
      currency: 'usd',
      capture_method: 'manual',
      metadata: {
        lobbyId,
        role,
        dealType,
        createdFor: isHost ? 'Host_Share' : 'Partner_Share'
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