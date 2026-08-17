import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { lobbyId } = await req.json();

    if (!lobbyId) {
      return NextResponse.json({ error: 'Missing lobbyId' }, { status: 400 });
    }

    // 1. Fetch lobby record from Supabase
    const { data: lobby, error: fetchError } = await supabase
      .from('lobbies')
      .select('*')
      .eq('id', lobbyId)
      .single();

    if (fetchError || !lobby) {
      return NextResponse.json({ error: 'Lobby not found' }, { status: 404 });
    }

    if (!lobby.host_payment_intent_id || !lobby.partner_payment_intent_id) {
      return NextResponse.json({ error: 'Both partners must authorize payments first' }, { status: 400 });
    }

    // 2. Retrieve both PaymentIntents from Stripe to verify their status
    const [hostPI, partnerPI] = await Promise.all([
      stripe.paymentIntents.retrieve(lobby.host_payment_intent_id),
      stripe.paymentIntents.retrieve(lobby.partner_payment_intent_id),
    ]);

    // Ensure BOTH payment holds are ready to be captured (status === 'requires_capture')
    if (hostPI.status !== 'requires_capture' || partnerPI.status !== 'requires_capture') {
      return NextResponse.json(
        {
          error: `Payment holds not ready for capture. Host status: ${hostPI.status}, Partner status:${partnerPI.status}`
        },
        { status: 400 }
      );
    }

    // 3. Capture both Stripe payment holds simultaneously
    await Promise.all([
      stripe.paymentIntents.capture(lobby.host_payment_intent_id),
      stripe.paymentIntents.capture(lobby.partner_payment_intent_id),
    ]);

    // 4. Update lobby status in Supabase
    const { error: updateError } = await supabase
      .from('lobbies')
      .update({ status: 'COMPLETED' })
      .eq('id', lobbyId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, status: 'COMPLETED' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
