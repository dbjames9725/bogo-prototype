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
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    // Confirm payment authorization without full-page redirect
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: 'if_required', // Prevents hanging on 'Proceeding...'
    });

    if (error) {
      setErrorMessage(error.message || 'Payment failed. Please try again.');
      setLoading(false);
      return;
    }

    // Check if the payment hold was authorized successfully
    if (paymentIntent && (paymentIntent.status === 'requires_capture' || paymentIntent.status === 'succeeded')) {
      try {
        await onSuccess();
      } catch (err: any) {
        setErrorMessage(err.message || 'Failed to complete lobby confirmation.');
      }
    } else {
      setErrorMessage('Payment hold could not be processed.');
    }

    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />

      {errorMessage && (
        <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
          {errorMessage}
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
