import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { stripe } from '@/lib/stripe';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// 50 States + DC Tax Rate Lookup
const STATE_TAX_RATES: Record<string, number> = {
  AL: 0.0924, AK: 0.0181, AZ: 0.0837, AR: 0.0944, CA: 0.0885, CO: 0.0778,
  CT: 0.0635, DE: 0.0000, DC: 0.0600, FL: 0.0700, GA: 0.0738, HI: 0.0444,
  ID: 0.0603, IL: 0.0884, IN: 0.0700, IA: 0.0694, KS: 0.0865, KY: 0.0600,
  LA: 0.0956, ME: 0.0550, MD: 0.0600, MA: 0.0625, MI: 0.0600, MN: 0.0803,
  MS: 0.0707, MO: 0.0833, MT: 0.0000, NE: 0.0697, NV: 0.0823, NH: 0.0000,
  NJ: 0.0660, NM: 0.0772, NY: 0.0853, NC: 0.0698, ND: 0.0696, OH: 0.0724,
  OK: 0.0899, OR: 0.0000, PA: 0.0634, RI: 0.0700, SC: 0.0744, SD: 0.0611,
  TN: 0.0955, TX: 0.0820, UT: 0.0722, VT: 0.0636, VA: 0.0577, WA: 0.0938,
  WV: 0.0657, WI: 0.0543, WY: 0.0536,
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: Request) {
  try {
    const { lobbyId, role, customPrice, userState } = await req.json();

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

    // Dynamic Price Resolution: Use custom price if passed, otherwise fallback to DB
    const itemPrice = customPrice !== undefined ? Number(customPrice) : (lobby.item_price || 0);
    const itemPriceCents = Math.round(itemPrice * 100);

    const dealType = (lobby.deal_type || 'BOGO').toUpperCase();
    const isBogo50 = dealType === 'BOGO_50' || dealType === 'BUY_1_GET_1_50_OFF';

    // Base Share in Integer Cents
    const combinedTotalCents = isBogo50 ? Math.round(itemPriceCents * 1.5) : itemPriceCents;
    const baseShareCents = Math.round(combinedTotalCents / 2);

    // 5% Platform fee calculated STRICTLY on retail item price, split in half
    const totalPlatformFeeCents = Math.round(itemPriceCents * 0.05);
    const platformFeeCents = Math.round(totalPlatformFeeCents / 2);

    // Dynamic State Tax Lookup
    const stateTaxRate = STATE_TAX_RATES[userState?.toUpperCase()] ?? 0.07;
    const estimatedTaxCents = Math.round(baseShareCents * stateTaxRate);

    // Stripe fee (2.9% + 30 cents) calculated on (baseShare + tax)
    const stripeFeeCents = Math.round((baseShareCents + estimatedTaxCents) * 0.029 + 30);

    // Total amount due per person
    const amountInCents = baseShareCents + platformFeeCents + estimatedTaxCents + stripeFeeCents;

    const isHost = role === 'HOST';
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      capture_method: 'manual',
      metadata: {
        lobbyId,
        role,
        itemPrice: itemPrice.toString(),
        userState: userState || 'DEFAULT',
        dealType,
      },
    });

    const updateColumn = isHost
      ? { host_payment_intent_id: paymentIntent.id, item_price: itemPrice }
      : { partner_payment_intent_id: paymentIntent.id };

    await supabase.from('lobbies').update(updateColumn).eq('id', lobbyId);

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