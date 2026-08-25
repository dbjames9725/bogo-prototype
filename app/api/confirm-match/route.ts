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

    // 1. Fetch current lobby record
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

    // If already marked MATCHED in Supabase, return success immediately
    if (lobby.status === 'MATCHED') {
      return NextResponse.json({ success: true, status: 'MATCHED' }, { headers: corsHeaders });
    }

    const { host_payment_intent_id, partner_payment_intent_id } = lobby;

    if (!host_payment_intent_id || !partner_payment_intent_id) {
      return NextResponse.json(
        { error: 'Both payment holds are required before confirming match' },
        { status: 400, headers: corsHeaders }
      );
    }

    // 2. Safely capture each hold independently, ignoring "already captured" responses
    const captureIntentSafely = async (intentId: string) => {
      try {
        const intent = await stripe.paymentIntents.retrieve(intentId);
        if (intent.status === 'requires_capture') {
          await stripe.paymentIntents.capture(intentId);
        }
      } catch (err: any) {
        // If captured by Stripe Webhook concurrently, ignore the error
        if (!err.message?.includes('already been captured')) {
          throw err;
        }
      }
    };

    await Promise.all([
      captureIntentSafely(host_payment_intent_id),
      captureIntentSafely(partner_payment_intent_id),
    ]);

    // 3. Update Supabase lobby status to MATCHED
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
      { error: err.message || 'Failed processing match confirmation' },
      { status: 500, headers: corsHeaders }
    );
  }
}
