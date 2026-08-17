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
      setErrorMessage("Stripe hasn't loaded yet. Please wait a second and try again.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      console.log('Confirming Stripe payment...');
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: 'if_required',
      });

      if (error) {
        console.error('Stripe confirm error:', error);
        setErrorMessage(error.message || 'Payment authorization failed.');
        setLoading(false);
        return;
      }

      console.log('PaymentIntent status:', paymentIntent?.status);

      if (paymentIntent && (paymentIntent.status === 'requires_capture' || paymentIntent.status === 'succeeded')) {
        console.log('Payment hold successful! Executing confirm-match...');
        await onSuccess();
      } else {
        setErrorMessage(`Unexpected payment status: ${paymentIntent?.status}`);
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      setErrorMessage(err.message || 'An unexpected error occurred during checkout.');
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
        {loading ? 'Processing Hold...' : buttonText || 'Pay & Authorize'}
      </button>
    </form>
  );
}
