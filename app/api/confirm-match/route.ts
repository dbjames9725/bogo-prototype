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
        { error: 'Missing lobbyId' },
        { status: 400, headers: corsHeaders }
      );
    }

    // 1. Retrieve full lobby details from Supabase
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

    // 2. Return success if already matched
    if (lobby.status === 'MATCHED') {
      return NextResponse.json({ success: true, status: 'MATCHED' }, { headers: corsHeaders });
    }

    const { host_payment_intent_id, partner_payment_intent_id } = lobby;

    if (!host_payment_intent_id || !partner_payment_intent_id) {
      return NextResponse.json(
        { error: 'Cannot capture: Missing Host or Partner payment hold' },
        { status: 400, headers: corsHeaders }
      );
    }

    // 3. Simultaneously capture both PaymentIntents in Stripe
    await Promise.all([
      stripe.paymentIntents.capture(host_payment_intent_id),
      stripe.paymentIntents.capture(partner_payment_intent_id),
    ]);

    // 4. Update status in Supabase to MATCHED
    await supabase
      .from('lobbies')
      .update({ status: 'MATCHED' })
      .eq('id', lobbyId);

    return NextResponse.json(
      { success: true, status: 'MATCHED' },
      { headers: corsHeaders }
    );
  } catch (err: any) {
    console.error('Confirm match capture failure:', err.message);
    return NextResponse.json(
      { error: err.message || 'Failed capturing dual payments' },
      { status: 500, headers: corsHeaders }
    );
  }
}