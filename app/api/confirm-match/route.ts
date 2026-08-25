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

    // 1. Fetch current lobby record
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

    if (lobby.status === 'MATCHED') {
      return NextResponse.json({ success: true, status: 'MATCHED' }, { headers: corsHeaders });
    }

    let hostHoldId = lobby.host_payment_intent_id;
    let partnerHoldId = lobby.partner_payment_intent_id;

    // Fallback: If Host hold ID is missing in Supabase, search Stripe PaymentIntents by lobbyId metadata
    if (!hostHoldId) {
      const searchResults = await stripe.paymentIntents.search({
        query: `metadata['lobbyId']:'${lobbyId}' AND metadata['role']:'HOST'`,
      });

      if (searchResults.data.length > 0) {
        hostHoldId = searchResults.data[0].id;
        // Repair database record asynchronously
        await supabase.from('lobbies').update({ host_payment_intent_id: hostHoldId }).eq('id', lobbyId);
      }
    }

    if (!hostHoldId || !partnerHoldId) {
      return NextResponse.json(
        {
          error: `Missing hold: Host (${hostHoldId ? 'OK' : 'MISSING'}), Partner (${partnerHoldId ? 'OK' : 'MISSING'})`,
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // 2. Capture both PaymentIntents simultaneously in Stripe
    await Promise.all([
      stripe.paymentIntents.capture(hostHoldId),
      stripe.paymentIntents.capture(partnerHoldId),
    ]);

    // 3. Mark lobby as MATCHED
    await supabase
      .from('lobbies')
      .update({ status: 'MATCHED' })
      .eq('id', lobbyId);

    return NextResponse.json(
      { success: true, status: 'MATCHED' },
      { headers: corsHeaders }
    );
  } catch (err: any) {
    console.error('Confirm Match Capture Error:', err.message);
    return NextResponse.json(
      { error: err.message || 'Failed capturing payment holds' },
      { status: 500, headers: corsHeaders }
    );
  }
}
