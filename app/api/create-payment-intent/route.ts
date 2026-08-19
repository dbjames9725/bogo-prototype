import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

export async function POST(req: Request) {
  try {
    const { amount, lobbyId, role } = await req.json();

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid or missing amount' }, { status: 400 });
    }

    // Convert dollars to cents for Stripe
    const amountInCents = Math.round(amount * 100);

    // Create PaymentIntent with manual capture method (pre-authorization hold)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      capture_method: 'manual', // Holds funds without charging until match confirmation
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
    console.error('Stripe Payment Intent Generation Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
