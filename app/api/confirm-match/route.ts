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
        { error: 'Missing required parameter: lobbyId' },
        { status: 400, headers: corsHeaders }
      );
    }

    // 1. Fetch Lobby Details
    const { data: lobby, error: fetchErr } = await supabase
      .from('lobbies')
      .select('*')
      .eq('id', lobbyId)
      .single();

    if (fetchErr || !lobby) {
      return NextResponse.json(
        { error: 'Lobby record not found in database' },
        { status: 404, headers: corsHeaders }
      );
    }

    // Idempotency Check: Prevent duplicate captures or card creations
    if (lobby.status === 'MATCHED' && lobby.issuing_card_id) {
      return NextResponse.json(
        { message: 'Lobby already matched and virtual card issued', cardId: lobby.issuing_card_id },
        { headers: corsHeaders }
      );
    }

    const { host_payment_intent_id, partner_payment_intent_id, item_price, deal_type } = lobby;

    if (!host_payment_intent_id || !partner_payment_intent_id) {
      return NextResponse.json(
        { error: 'Both host and partner must authorize payment holds before issuing virtual card' },
        { status: 400, headers: corsHeaders }
      );
    }

    // 2. CAPTURE DUAL PAYMENT HOLDS
    // Convert status from "requires_capture" to captured funds
    const [hostCapture, partnerCapture] = await Promise.all([
      stripe.paymentIntents.capture(host_payment_intent_id),
      stripe.paymentIntents.capture(partner_payment_intent_id),
    ]);

    if (hostCapture.status !== 'succeeded' || partnerCapture.status !== 'succeeded') {
      return NextResponse.json(
        { error: 'Failed capturing one or both payment holds' },
        { status: 500, headers: corsHeaders }
      );
    }

    // 3. CALCULATE VIRTUAL CARD SPENDING LIMIT
    const itemPriceCents = Math.round((Number(item_price) || 0) * 100);
    const isBogo50 = deal_type === 'BOGO_50' || deal_type === 'BUY_1_GET_1_50_OFF';

    // Total cost on merchant site + 8% buffer for estimated local tax/shipping
    const dealTotalCents = isBogo50 ? Math.round(itemPriceCents * 1.5) : itemPriceCents;
    const spendingLimitCents = Math.round(dealTotalCents * 1.08);

    // 4. CREATE STRIPE ISSUING CARDHOLDER & SINGLE-USE VIRTUAL CARD
    const cardholder = await stripe.issuing.cardholders.create({
      name: `BOGO Split Match #${lobbyId.slice(0, 8)}`,
      type: 'individual',
      email: 'fulfillment@bogosplit.com',
      billing: {
        address: {
          line1: '123 Tech Way',
          city: 'New York',
          state: 'NY',
          postal_code: '10001',
          country: 'US',
        },
      },
    });

    const virtualCard = await stripe.issuing.cards.create({
      cardholder: cardholder.id,
      currency: 'usd',
      type: 'virtual',
      status: 'active',
      spending_controls: {
        spending_limits: [
          {
            amount: spendingLimitCents,
            interval: 'all_time',
          },
        ],
      },
      metadata: {
        lobbyId,
        itemName: lobby.item_name,
      },
    });

    // 5. UPDATE DATABASE WITH MATCH STATUS & ISSUING CARD ID
    const { error: updateErr } = await supabase
      .from('lobbies')
      .update({
        status: 'MATCHED',
        issuing_card_id: virtualCard.id,
        virtual_card_last4: virtualCard.last4,
      })
      .eq('id', lobbyId);

    if (updateErr) {
      console.error('Failed to update lobby with issuing card metadata:', updateErr);
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Dual holds captured and virtual card issued successfully!',
        lobbyId,
        card: {
          id: virtualCard.id,
          last4: virtualCard.last4,
          expMonth: virtualCard.exp_month,
          expYear: virtualCard.exp_year,
          spendingLimit: spendingLimitCents / 100,
        },
      },
      { headers: corsHeaders }
    );
  } catch (err: any) {
    console.error('Confirm Match & Issuing Error:', err.message);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
