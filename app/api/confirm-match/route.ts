import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabase } from '@/lib/supabase';
import EasyPostClient from '@easypost/api';
import { sendMatchCompletionEmails } from '@/lib/email';

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

    if (lobby.status === 'MATCHED') {
      return NextResponse.json({ message: 'Lobby already matched', lobby });
    }

    // 2. Capture payment intents for both Host (User A) and Partner (User B)
    if (lobby.host_payment_intent_id) {
      await stripe.paymentIntents.capture(lobby.host_payment_intent_id);
    }

    if (lobby.partner_payment_intent_id) {
      await stripe.paymentIntents.capture(lobby.partner_payment_intent_id);
    }

    // 3. Generate EasyPost Return Shipping Label (Host User A -> Partner User B)
    let shippingLabelUrl = '';
    let trackingCode = '';

    if (process.env.EASYPOST_API_KEY && lobby.user_a_address && lobby.user_b_address) {
      try {
        const easypost = new EasyPostClient(process.env.EASYPOST_API_KEY);

        const shipment = await easypost.Shipment.create({
          from_address: {
            name: lobby.user_a_address.name || 'BOGO Host',
            street1: lobby.user_a_address.street1,
            city: lobby.user_a_address.city,
            state: lobby.user_a_address.state,
            zip: lobby.user_a_address.zip,
            country: 'US',
          },
          to_address: {
            name: lobby.user_b_address.name || 'BOGO Partner',
            street1: lobby.user_b_address.street1,
            city: lobby.user_b_address.city,
            state: lobby.user_b_address.state,
            zip: lobby.user_b_address.zip,
            country: 'US',
          },
          parcel: {
            length: 10,
            width: 8,
            height: 4,
            weight: 24, // 1.5 lbs default parcel weight
          },
        });

        const boughtShipment = await easypost.Shipment.buy(
          shipment.id,
          shipment.lowestRate(['USPS'], ['First', 'GroundAdvantage', 'Priority'])
        );

        shippingLabelUrl = boughtShipment.postage_label?.label_url || '';
        trackingCode = boughtShipment.tracking_code || '';
      } catch (shippingErr: any) {
        console.error('EasyPost Shipping Label Generation Failed:', shippingErr.message);
      }
    }

    // 4. Update lobby status in Supabase to MATCHED
    const { error: updateError } = await supabase
      .from('lobbies')
      .update({
        status: 'MATCHED',
        shipping_label_url: shippingLabelUrl || null,
        tracking_code: trackingCode || null,
      })
      .eq('id', lobbyId);

    if (updateError) {
      console.error('Supabase Match Status Update Error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // 5. Trigger email notifications via Resend
    try {
      await sendMatchCompletionEmails({
        lobbyId,
        itemName: lobby.item_name,
        userAAddress: lobby.user_a_address,
        userBAddress: lobby.user_b_address,
        shippingLabelUrl: shippingLabelUrl || '',
        trackingCode: trackingCode || '',
      });
    } catch (emailErr: any) {
      console.error('Email Notification Error:', emailErr.message);
    }

    return NextResponse.json({
      success: true,
      message: 'Match confirmed, payments captured, and shipping label generated!',
      shippingLabelUrl,
      trackingCode,
    });
  } catch (err: any) {
    console.error('Confirm Match Endpoint Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
