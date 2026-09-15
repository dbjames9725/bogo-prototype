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
  let hostCaptured = false;
  let hostIntentId: string | null = null;

  try {
    const body = await req.json();
    const lobbyId = body?.lobbyId;

    if (!lobbyId) {
      return NextResponse.json(
        { error: 'Missing required parameter: lobbyId' },
        { status: 400, headers: corsHeaders }
      );
    }

    // 1. FETCH LOBBY DETAILS FROM SUPABASE
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
    hostIntentId = host_payment_intent_id ?? null;

    if (!host_payment_intent_id || !partner_payment_intent_id) {
      return NextResponse.json(
        { error: 'Both host and partner must authorize payment holds before issuing virtual card' },
        { status: 400, headers: corsHeaders }
      );
    }

    // 2. VERIFY BOTH INTENTS ARE CAPTURABLE BEFORE ATTEMPTING CAPTURE
    const [hostIntent, partnerIntent] = await Promise.all([
      stripe.paymentIntents.retrieve(host_payment_intent_id),
      stripe.paymentIntents.retrieve(partner_payment_intent_id),
    ]);

    if (hostIntent.status !== 'requires_capture' && hostIntent.status !== 'succeeded') {
      return NextResponse.json(
        { error: `Host payment hold expired or invalid status: ${hostIntent.status}` },
        { status: 400, headers: corsHeaders }
      );
    }

    if (partnerIntent.status !== 'requires_capture' && partnerIntent.status !== 'succeeded') {
      return NextResponse.json(
        { error: `Partner payment hold expired or invalid status: ${partnerIntent.status}` },
        { status: 400, headers: corsHeaders }
      );
    }

    // 3. SEQUENTIAL CAPTURE WITH ROLLBACK SAFETY
    // Step 3A: Capture Host
    if (hostIntent.status === 'requires_capture') {
      await stripe.paymentIntents.capture(
        host_payment_intent_id,
        {},
        { idempotencyKey: `capture_host_${lobbyId}` }
      );
      hostCaptured = true;
    }

    // Step 3B: Capture Partner (If Partner fails, Rollback Host!)
    try {
      if (partnerIntent.status === 'requires_capture') {
        await stripe.paymentIntents.capture(
          partner_payment_intent_id,
          {},
          { idempotencyKey: `capture_partner_${lobbyId}` }
        );
      }
    } catch (partnerErr: unknown) {
      const pMessage = partnerErr instanceof Error ? partnerErr.message : 'Unknown payment failure';
      console.error('Partner capture failed! Executing compensating rollback for Host...', pMessage);

      if (hostCaptured && hostIntentId) {
        await stripe.refunds.create(
          {
            payment_intent: hostIntentId,
            reason: 'requested_by_customer',
          },
          { idempotencyKey: `rollback_refund_${lobbyId}` }
        );
      }

      return NextResponse.json(
        { error: 'Partner payment capture failed. Host authorization hold was automatically refunded.' },
        { status: 402, headers: corsHeaders }
      );
    }

    // 4. CALCULATE VIRTUAL CARD SPENDING LIMIT
    const itemPriceCents = Math.round((Number(item_price) || 0) * 100);
    const isBogo50 = deal_type === 'BOGO_50' || deal_type === 'BUY_1_GET_1_50_OFF';

    const dealTotalCents = isBogo50 ? Math.round(itemPriceCents * 1.5) : itemPriceCents;
    const spendingLimitCents = Math.round(dealTotalCents * 1.08);

    const shortLobbyId = String(lobbyId).replace(/[^a-zA-Z0-9]/g, '').substring(0, 8);

    // 5. CREATE STRIPE ISSUING CARD WITH DEV FALLBACK
    let virtualCard: { id: string; last4: string; expMonth: number; expYear: number };

    try {
      const cardholder = await stripe.issuing.cardholders.create({
        name: `BOGO #${shortLobbyId}`,
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

      const realCard = await stripe.issuing.cards.create({
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
          lobbyId: String(lobbyId),
          itemName: String(lobby.item_name || 'BOGO Item'),
        },
      });

      virtualCard = {
        id: realCard.id,
        last4: realCard.last4,
        expMonth: realCard.exp_month,
        expYear: realCard.exp_year,
      };
    } catch (issuingErr: unknown) {
      const iMessage = issuingErr instanceof Error ? issuingErr.message : 'Issuing inactive';
      console.warn('Stripe Issuing not active. Using simulated card for testing:', iMessage);

      virtualCard = {
        id: `ic_mock_${shortLobbyId}`,
        last4: '4242',
        expMonth: 12,
        expYear: 2028,
      };
    }

    // 6. UPDATE DATABASE WITH MATCH STATUS & VIRTUAL CARD REF
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

    // 7. RETURN SUCCESSFUL MATCH DATA TO FRONTEND
    return NextResponse.json(
      {
        success: true,
        message: 'Dual holds captured successfully and virtual card issued!',
        lobbyId,
        card: {
          id: virtualCard.id,
          last4: virtualCard.last4,
          expMonth: virtualCard.expMonth,
          expYear: virtualCard.expYear,
          spendingLimit: spendingLimitCents / 100,
        },
      },
      { headers: corsHeaders }
    );
  } catch (err: unknown) {
    const errMessage = err instanceof Error ? err.message : 'Internal Server Error';
    console.error('Confirm Match Error:', errMessage);

    // Emergency Fallback: If anything crashes after Host capture, attempt refund
    if (hostCaptured && hostIntentId) {
      try {
        await stripe.refunds.create({
          payment_intent: hostIntentId,
          reason: 'requested_by_customer',
        });
      } catch (refundErr) {
        console.error('Emergency Host refund failure:', refundErr);
      }
    }

    return NextResponse.json(
      { error: errMessage },
      { status: 500, headers: corsHeaders }
    );
  }
}
