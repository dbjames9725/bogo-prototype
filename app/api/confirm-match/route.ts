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

    // 1. Retry polling loop: Query Supabase up to 5 times (2.5s total) for both holds to settle
    let lobby = null;
    for (let i = 0; i < 5; i++) {
      const { data } = await supabase
        .from('lobbies')
        .select('*')
        .eq('id', lobbyId)
        .single();

      if (data) {
        if (data.status === 'MATCHED') {
          return NextResponse.json({ success: true, status: 'MATCHED' }, { headers: corsHeaders });
        }

        if (data.host_payment_intent_id && data.partner_payment_intent_id) {
          lobby = data;
          break;
        }
      }

      // Wait 500ms before retrying database read
      await new Promise((res) => setTimeout(res, 500));
      lobby = data;
    }

    if (!lobby) {
      return NextResponse.json(
        { error: 'Lobby not found in database' },
        { status: 404, headers: corsHeaders }
      );
    }

    const { host_payment_intent_id, partner_payment_intent_id } = lobby;

    if (!host_payment_intent_id || !partner_payment_intent_id) {
      return NextResponse.json(
        {
          error: `Missing payment hold: Host (${host_payment_intent_id ? 'OK' : 'MISSING'}), Partner (${partner_payment_intent_id ? 'OK' : 'MISSING'})`
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // 2. Safely capture both Stripe payment holds
    const captureSafely = async (intentId: string) => {
      try {
        const intent = await stripe.paymentIntents.retrieve(intentId);
        if (intent.status === 'requires_capture') {
          await stripe.paymentIntents.capture(intentId);
        }
      } catch (err: any) {
        if (!err.message?.includes('already been captured')) {
          throw err;
        }
      }
    };

    await Promise.all([
      captureSafely(host_payment_intent_id),
      captureSafely(partner_payment_intent_id),
    ]);

    // 3. Mark lobby status as MATCHED in Supabase
    await supabase
      .from('lobbies')
      .update({ status: 'MATCHED' })
      .eq('id', lobbyId);

    return NextResponse.json(
      { success: true, status: 'MATCHED' },
      { headers: corsHeaders }
    );
  } catch (err: any) {
    console.error('Confirm match error:', err.message);
    return NextResponse.json(
      { error: err.message || 'Failed processing dual-hold capture' },
      { status: 500, headers: corsHeaders }
    );
  }
}
