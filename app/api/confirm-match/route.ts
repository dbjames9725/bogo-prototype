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

    // Polling retry loop to handle Supabase DB propagation delay
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

        if (data.status === 'PROCESSING') {
          return NextResponse.json({ success: true, status: 'PROCESSING' }, { headers: corsHeaders });
        }

        if (data.host_payment_intent_id && data.partner_payment_intent_id) {
          lobby = data;
          break;
        }
      }

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

    // Optimistic Concurrency Check: Lock status to PROCESSING to prevent parallel captures
    const { data: lockedLobby, error: lockError } = await supabase
      .from('lobbies')
      .update({ status: 'PROCESSING' })
      .eq('id', lobbyId)
      .eq('status', 'PENDING')
      .select()
      .single();

    if (lockError || !lockedLobby) {
      // Another concurrent request is already capturing this match
      return NextResponse.json({ success: true, status: 'PROCESSING' }, { headers: corsHeaders });
    }

    const captureSafely = async (intentId: string) => {
      const intent = await stripe.paymentIntents.retrieve(intentId);
      if (intent.status === 'requires_capture') {
        await stripe.paymentIntents.capture(intentId);
      }
    };

    // Atomic Dual-Capture Logic with Rollback Protection
    let hostCaptured = false;
    let partnerCaptured = false;

    try {
      // Step 1: Capture Host hold
      await captureSafely(host_payment_intent_id);
      hostCaptured = true;

      // Step 2: Capture Partner hold
      await captureSafely(partner_payment_intent_id);
      partnerCaptured = true;

      // Step 3: Mark Lobby as MATCHED
      await supabase
        .from('lobbies')
        .update({ status: 'MATCHED' })
        .eq('id', lobbyId);

      return NextResponse.json(
        { success: true, status: 'MATCHED' },
        { headers: corsHeaders }
      );
    } catch (captureErr: any) {
      console.error('Dual Capture Error encountered during process:', captureErr.message);

      // Rollback Handling: If one payment captured but the other failed, refund the captured charge immediately
      if (hostCaptured && !partnerCaptured) {
        console.warn('Refunding Host intent due to Partner capture failure:', host_payment_intent_id);
        await stripe.refunds.create({ payment_intent: host_payment_intent_id }).catch((e) => {
          console.error('Critical: Failed to refund Host hold:', e.message);
        });
      } else if (!hostCaptured && partnerCaptured) {
        console.warn('Refunding Partner intent due to Host capture failure:', partner_payment_intent_id);
        await stripe.refunds.create({ payment_intent: partner_payment_intent_id }).catch((e) => {
          console.error('Critical: Failed to refund Partner hold:', e.message);
        });
      }

      // Mark Lobby status as FAILED so client UI can inform users
      await supabase
        .from('lobbies')
        .update({ status: 'FAILED' })
        .eq('id', lobbyId);

      return NextResponse.json(
        { error: `Payment capture failed: ${captureErr.message}. Any authorized charges were refunded.` },
        { status: 500, headers: corsHeaders }
      );
    }
  } catch (err: any) {
    console.error('Confirm match server route error:', err.message);
    return NextResponse.json(
      { error: err.message || 'Failed processing dual-hold capture' },
      { status: 500, headers: corsHeaders }
    );
  }
}
