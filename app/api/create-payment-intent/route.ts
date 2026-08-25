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
    const { lobbyId } = await req.json();

    if (!lobbyId) {
      return NextResponse.json(
        { error: 'Missing lobbyId parameter' },
        { status: 400, headers: corsHeaders }
      );
    }

    // 1. Fetch lobby record from Supabase
    const { data: lobby, error } = await supabase
      .from('lobbies')
      .select('*')
      .eq('id', lobbyId)
      .single();

    if (error || !lobby) {
      return NextResponse.json(
        { error: 'Lobby record not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    // 2. If Host intent exists and needs payment method, return Host secret
    if (lobby.host_payment_intent_id) {
      const hostIntent = await stripe.paymentIntents.retrieve(lobby.host_payment_intent_id);
      if (hostIntent && hostIntent.status === 'requires_payment_method') {
        return NextResponse.json(
          {
            clientSecret: hostIntent.client_secret,
            paymentIntentId: hostIntent.id,
            assignedRole: 'HOST',
          },
          { headers: corsHeaders }
        );
      }
    }

    // 3. Otherwise, check/generate Partner PaymentIntent
    if (lobby.partner_payment_intent_id) {
      const partnerIntent = await stripe.paymentIntents.retrieve(lobby.partner_payment_intent_id);
      if (partnerIntent && partnerIntent.status === 'requires_payment_method') {
        return NextResponse.json(
          {
            clientSecret: partnerIntent.client_secret,
            paymentIntentId: partnerIntent.id,
            assignedRole: 'PARTNER',
          },
          { headers: corsHeaders }
        );
      }
    }

    // 4. Generate new Partner PaymentIntent
    const originalPrice = lobby.item_price || 0;
    const baseShare = originalPrice / 2;
    const platformFee = originalPrice * 0.025;
    const stripeFee = baseShare * 0.029 + 0.30;
    const totalAmount = baseShare + platformFee + stripeFee;
    const amountInCents = Math.round(totalAmount * 100);

    const partnerIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      capture_method: 'manual',
      metadata: { lobbyId, role: 'PARTNER' },
    });

    // Save partner_payment_intent_id to database
    await supabase
      .from('lobbies')
      .update({ partner_payment_intent_id: partnerIntent.id })
      .eq('id', lobbyId);

    return NextResponse.json(
      {
        clientSecret: partnerIntent.client_secret,
        paymentIntentId: partnerIntent.id,
        assignedRole: 'PARTNER',
      },
      { headers: corsHeaders }
    );
  } catch (err: any) {
    console.error('Create Payment Intent Error:', err.message);
    return NextResponse.json(
      { error: err.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
