import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabase } from '@/lib/supabase';
import EasyPostClient from '@easypost/api';
import { sendMatchCompletionEmails } from '@/lib/email';

const easypost = new EasyPostClient(process.env.EASYPOST_API_KEY || '');

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

    if (hostPI.status !== 'requires_capture' || partnerPI.status !== 'requires_capture') {
      return NextResponse.json(
        { error: `Payment holds not ready for capture. Host status: ${hostPI.status}, Partner status:${partnerPI.status}` },
        { status: 400 }
      );
    }

    // 3. Capture both Stripe payment holds simultaneously
    await Promise.all([
      stripe.paymentIntents.capture(lobby.host_payment_intent_id),
      stripe.paymentIntents.capture(lobby.partner_payment_intent_id),
    ]);

    // 4. Generate Automated Shipping Label via EasyPost
    let labelUrl: string | null = null;
    let trackingNumber: string | null = null;

    if (lobby.user_a_address && lobby.user_b_address) {
      try {
        const shipment = await easypost.Shipment.create({
          from_address: {
            name: lobby.user_a_address.name,
            street1: lobby.user_a_address.street1,
            city: lobby.user_a_address.city,
            state: lobby.user_a_address.state,
            zip: lobby.user_a_address.zip,
            country: 'US',
          },
          to_address: {
            name: lobby.user_b_address.name,
            street1: lobby.user_b_address.street1,
            city: lobby.user_b_address.city,
            state: lobby.user_b_address.state,
            zip: lobby.user_b_address.zip,
            country: 'US',
          },
          parcel: {
            length: 10,
            width: 6,
            height: 4,
            weight: 24, // 24 oz (~1.5 lbs standard shoe box)
          },
        });

        // Buy cheapest available rate (USPS Ground Advantage)
        const boughtShipment = await easypost.Shipment.buy(shipment.id, shipment.rates[0].id);
        labelUrl = boughtShipment.postage_label.label_url;
        trackingNumber = boughtShipment.tracking_code;
      } catch (shipError) {
        console.error('EasyPost Label Error:', shipError);
      }
    }

    // 5. Update lobby status & shipping details in Supabase
    const { error: updateError } = await supabase
      .from('lobbies')
      .update({
        status: 'COMPLETED',
        shipping_label_url: labelUrl,
        tracking_number: trackingNumber,
      })
      .eq('id', lobbyId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // 6. Send Automated Emails to Host and Partner
    if (labelUrl && trackingNumber) {
      try {
        await sendMatchCompletionEmails({
          hostEmail: lobby.user_a_email || 'host@example.com',
          partnerEmail: lobby.user_b_email || 'partner@example.com',
          itemName: lobby.item_name || 'BOGO Offer Item',
          totalPrice: Number(lobby.total_price),
          trackingNumber,
          shippingLabelUrl: labelUrl,
          partnerAddress: lobby.user_b_address,
        });
      } catch (emailErr) {
        console.error('Email Notification Error:', emailErr);
        // Continue execution so transaction completes even if email delivery fails
      }
    }

    return NextResponse.json({
      success: true,
      status: 'COMPLETED',
      shippingLabelUrl: labelUrl,
      trackingNumber,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
