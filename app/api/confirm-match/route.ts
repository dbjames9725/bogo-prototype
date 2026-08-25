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

    // Retry loop: Query database up to 3 times to allow pending writes to settle
    let lobby = null;
    for (let i = 0; i < 3; i++) {
      const { data, error } = await supabase
        .from('lobbies')
        .select('*')
        .eq('id', lobbyId)
        .single();

      if (data && data.host_payment_intent_id && data.partner_payment_intent_id) {
        lobby = data;
        break;
      }

      if (data && data.status === 'MATCHED') {
        return NextResponse.json({ success: true, status: 'MATCHED' }, { headers: corsHeaders });
      }

      // Wait 500ms before retrying
      await new Promise((res) => setTimeout(res, 500));
      lobby = data;
    }

    if (!lobby) {
      return NextResponse.json(
        { error: 'Lobby not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    if (lobby.status === 'MATCHED') {
      return NextResponse.json({ success: true, status: 'MATCHED' }, { headers: corsHeaders });
    }

    const { host_payment_intent_id, partner_payment_intent_id } = lobby;

    if (!host_payment_intent_id || !partner_payment_intent_id) {
      return NextResponse.json(
        {
          error: `Missing hold: Host (${host_payment_intent_id ? 'OK' : 'MISSING'}), Partner (${partner_payment_intent_id ? 'OK' : 'MISSING'})`
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // Simultaneously capture both PaymentIntents in Stripe
    await Promise.all([
      stripe.paymentIntents.capture(host_payment_intent_id),
      stripe.paymentIntents.capture(partner_payment_intent_id),
    ]);

    // Update status in Supabase to MATCHED
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