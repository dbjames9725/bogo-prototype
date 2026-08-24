import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { stripe } from '@/lib/stripe';

export async function POST(req: Request) {
  try {
    const { lobbyId, role } = await req.json();

    if (!lobbyId || !role) {
      return NextResponse.json({ error: 'Missing required parameters: lobbyId or role' }, { status: 400 });
    }

    // 1. Fetch authentic lobby record directly from database
    const { data: lobby, error } = await supabase
      .from('lobbies')
      .select('*')
      .eq('id', lobbyId)
      .single();

    if (error || !lobby) {
      return NextResponse.json({ error: 'Lobby record not found in database' }, { status: 404 });
    }

    // 2. Perform authoritative server-side fee calculation
    const originalPrice = lobby.item_price || 0;
    const baseShare = originalPrice / 2;
    const platformFee = originalPrice * 0.025; // 2.5% Platform Fee
    const stripeFee = baseShare * 0.029 + 0.30; // 2.9% + $0.30 Processing Fee
    const totalAmount = baseShare + platformFee + stripeFee;

    // Convert total dollars to integer cents for Stripe API
    const amountInCents = Math.round(totalAmount * 100);

    if (amountInCents <= 0) {
      return NextResponse.json({ error: 'Invalid calculated payment amount' }, { status: 400 });
    }

    // 3. Create Stripe pre-authorization hold PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      capture_method: 'manual', // Hold funds until match confirmation
      metadata: {
        lobbyId,
        role,
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err: any) {
    console.error('Stripe Server Intent Validation Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
