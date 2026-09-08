import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16' as any,
});

export async function POST(req: Request) {
  try {
    const { amount, lobbyId, role, userEmail } = await req.json();

    if (!amount || !lobbyId || !role) {
      return NextResponse.json(
        { error: 'Missing required parameters: amount, lobbyId, or role' },
        { status: 400 }
      );
    }

    const shortLobbyId = String(lobbyId).replace(/[^a-zA-Z0-9]/g, '').substring(0, 8);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(Number(amount) * 100),
      currency: 'usd',
      capture_method: 'manual',
      description: `BOGO Hold #${shortLobbyId}`,
      statement_descriptor_suffix: `BOGO ${shortLobbyId}`,
      receipt_email: userEmail || undefined,
      metadata: {
        lobbyId: String(lobbyId),
        role: String(role),
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err: any) {
    console.error('Error creating Stripe payment hold:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to create payment hold' },
      { status: 500 }
    );
  }
}
