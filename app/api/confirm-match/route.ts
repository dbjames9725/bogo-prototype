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

    // 1. Fetch current lobby state from Supabase
    const { data: lobby, error } = await supabase
      .from('lobbies')
      .select('*')
      .eq('id', lobbyId)
      .single();

    if (error || !lobby) {
      return NextResponse.json(
        { error: 'Lobby not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    // If already matched, exit gracefully
    if (lobby.status === 'MATCHED') {
      return NextResponse.json(
        { success: true, message: 'Already matched' },
        { headers: corsHeaders }
      );
    }

    const { host_payment_intent_id, partner_payment_intent_id } = lobby;

    if (!host_payment_intent_id || !partner_payment_intent_id) {
      return NextResponse.json(
        { error: 'Both payment holds are required before confirming match' },
        { status: 400, headers: corsHeaders }
      );
    }

    // 2. Capture both Stripe holds simultaneously
    console.log(`Capturing holds for Lobby ${lobbyId}: Host (${host_payment_intent_id}), Partner (${partner_payment_intent_id})`);

    await Promise.all([
      stripe.paymentIntents.capture(host_payment_intent_id),
      stripe.paymentIntents.capture(partner_payment_intent_id),
    ]);

    // 3. Update Supabase lobby status to MATCHED
    const { error: updateError } = await supabase
      .from('lobbies')
      .update({ status: 'MATCHED' })
      .eq('id', lobbyId);

    if (updateError) {
      console.error('Failed to update lobby status to MATCHED:', updateError);
    }

    return NextResponse.json(
      { success: true, status: 'MATCHED' },
      { headers: corsHeaders }
    );
  } catch (err: any) {
    console.error('Confirm Match Capture Error:', err.message);
    return NextResponse.json(
      { error: err.message || 'Failed to capture payment holds' },
      { status: 500, headers: corsHeaders }
    );
  }
}