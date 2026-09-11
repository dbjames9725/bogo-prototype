import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { stripe } from '@/lib/stripe';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// UNIFIED COMBINED STATE + LOCAL TAX RATES
const STATE_TAX_RATES: Record<string, number> = {
  AK: 0.0181, AL: 0.0924, AR: 0.0944, AZ: 0.0837, CA: 0.0885, CO: 0.0778, CT: 0.0635,
  DC: 0.0600, DE: 0.0000, FL: 0.0700, GA: 0.0738, HI: 0.0444, IA: 0.0694, ID: 0.0603,
  IL: 0.0884, IN: 0.0700, KS: 0.0865, KY: 0.0600, LA: 0.0956, MA: 0.0625, MD: 0.0600,
  ME: 0.0550, MI: 0.0600, MN: 0.0803, MS: 0.0707, MO: 0.0833, MT: 0.0000, NC: 0.0698,
  ND: 0.0696, NE: 0.0697, NH: 0.0000, NJ: 0.0660, NM: 0.0772, NV: 0.0823, NY: 0.0853,
  OH: 0.0724, OK: 0.0899, OR: 0.0000, PA: 0.0634, RI: 0.0700, SC: 0.0744, SD: 0.0611,
  TN: 0.0955, TX: 0.0820, UT: 0.0722, VA: 0.0577, VT: 0.0636, WA: 0.0938, WI: 0.0543,
  WV: 0.0657, WY: 0.0536,
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: Request) {
  try {
    const { lobbyId, role, userState, paymentIntentId } = await req.json();

    if (!lobbyId || !role) {
      return NextResponse.json(
        { error: 'Missing required parameters: lobbyId or role' },
        { status: 400, headers: corsHeaders }
      );
    }

    const { data: lobby, error } = await supabase
      .from('lobbies')
      .select('*')
      .eq('id', lobbyId)
      .single();

    if (error || !lobby) {
      return NextResponse.json(
        { error: 'Lobby record not found in database' },
        { status: 404, headers: corsHeaders }
      );
    }

    const itemPrice = Number(lobby.item_price) || 0;
    const dealType = (lobby.deal_type || 'BOGO').toUpperCase();
    const isBogo50 = dealType === 'BOGO_50' || dealType === 'BUY_1_GET_1_50_OFF';

    // 1. Base Split Share
    const bogoPromoTotal = isBogo50 ? itemPrice * 1.5 : itemPrice;
    const splitBase = bogoPromoTotal / 2; // e.g. $60.00 for a $120 item

    // 2. Platform Fee (2.5% of Split Base = $1.50)
    const platformFee = Math.round(splitBase * 0.025 * 100) / 100;

    // 3. Dynamic State Tax (Reads selected state or defaults to NY 8.53%)
    const selectedState = (userState || 'NY').toUpperCase();
    const taxRate = STATE_TAX_RATES[selectedState] ?? 0.0853;
    const calculatedTax = Math.round(splitBase * taxRate * 100) / 100;

    // 4. Stripe Fee (2.9% + $0.30)
    const stripeFee = Math.round((splitBase * 0.029 + 0.30) * 100) / 100;

    // 5. Total Hold Amount in Cents
    const totalAmount = splitBase + platformFee + calculatedTax + stripeFee;
    const validAmountCents = Math.max(50, Math.round(totalAmount * 100));

    const isHost = role === 'HOST';
    const shortLobbyId = String(lobbyId).replace(/[^a-zA-Z0-9]/g, '').substring(0, 8);

    let paymentIntent;

    // REUSE & UPDATE: If a paymentIntentId is provided, update the existing draft intent in Stripe
    if (paymentIntentId) {
      paymentIntent = await stripe.paymentIntents.update(paymentIntentId, {
        amount: validAmountCents,
        metadata: {
          lobbyId,
          role,
          dealType,
          userState: selectedState,
          taxAmount: calculatedTax.toString(),
          platformFee: platformFee.toString(),
          participantRole: isHost ? 'Host' : 'Partner',
        },
      });
    } else {
      // CREATE NEW: Only executed on initial page/form mount
      paymentIntent = await stripe.paymentIntents.create({
        amount: validAmountCents,
        currency: 'usd',
        capture_method: 'manual',
        description: `BOGO Hold #${shortLobbyId}`,
        statement_descriptor_suffix: `BOGO ${shortLobbyId}`,
        metadata: {
          lobbyId,
          role,
          dealType,
          userState: selectedState,
          taxAmount: calculatedTax.toString(),
          platformFee: platformFee.toString(),
          participantRole: isHost ? 'Host' : 'Partner',
        },
      });
    }

    return NextResponse.json(
      {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      },
      { headers: corsHeaders }
    );
  } catch (err: any) {
    console.error('Stripe Server Intent Error:', err.message);
    return NextResponse.json(
      { error: err.message },
      { status: 500, headers: corsHeaders }
    );
  }
}

