import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { lobbyId } = await req.json();

    if (!lobbyId) {
      return NextResponse.json({ error: 'Missing lobbyId' }, { status: 400 });
    }

    // 1. Fetch the lobby from Supabase
    const { data: lobby, error: fetchError } = await supabase
      .from('lobbies')
      .select('*')
      .eq('id', lobbyId)
      .single();

    if (fetchError || !lobby) {
      console.error('Fetch error or lobby missing:', fetchError);
      return NextResponse.json({ error: 'Lobby not found' }, { status: 404 });
    }

    // Check if payment intents are saved on the lobby record
    if (!lobby.host_payment_intent_id || !lobby.partner_payment_intent_id) {
      console.error('Missing payment intents on lobby:', {
        host: lobby.host_payment_intent_id,
        partner: lobby.partner_payment_intent_id,
      });
      return NextResponse.json(
        { error: 'Incomplete payment intent state in lobby' },
        { status: 400 }
      );
    }

    // 2. Capture both Stripe payment holds simultaneously
    await Promise.all([
      stripe.paymentIntents.capture(lobby.host_payment_intent_id),
      stripe.paymentIntents.capture(lobby.partner_payment_intent_id),
    ]);

    // 3. Mark the lobby as COMPLETED in Supabase
    const { error: updateError } = await supabase
      .from('lobbies')
      .update({ status: 'COMPLETED' })
      .eq('id', lobbyId);

    if (updateError) {
      console.error('Supabase status update error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, status: 'COMPLETED' });
  } catch (err: any) {
    console.error('Capture match error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

