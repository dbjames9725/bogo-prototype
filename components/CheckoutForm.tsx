'use client';

import React, { useState } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';

interface CheckoutFormProps {
  onSuccess: () => Promise<void>;
  buttonText?: string;
}

export default function CheckoutForm({ onSuccess, buttonText }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      setErrorMessage("Payment system is initializing. Please try again in a moment.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      // 1. Get origin-only URL without dirty query params
      const cleanReturnUrl = typeof window !== 'undefined'
        ? window.location.origin + window.location.pathname
        : '';

      // 2. Confirm Payment Authorization with Stripe
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: cleanReturnUrl,
        },
        redirect: 'if_required',
      });

      if (error) {
        // If Stripe says it's already authorized/succeeded, treat as success!
        if (error.code === 'payment_intent_unexpected_state') {
          await onSuccess();
          return;
        }
        setErrorMessage(error.message || 'Payment processing failed.');
        setLoading(false);
        return;
      }

      // 3. Verify Payment Hold Success & Capture
      if (
        paymentIntent &&
        (paymentIntent.status === 'requires_capture' || paymentIntent.status === 'succeeded')
      ) {
        await onSuccess();
      } else {
        setErrorMessage(`Payment status: ${paymentIntent?.status}. Please try again.`);
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      setErrorMessage(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />

      {errorMessage && (
        <div className="p-3 my-2 bg-red-100 text-red-800 text-sm rounded-lg border border-red-300 font-semibold">
          ⚠️ {errorMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full bg-emerald-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition cursor-pointer"
      >
        {loading ? 'Authorizing Hold...' : buttonText || 'Pay & Authorize'}
      </button>
    </form>
  );
}
