'use client';

import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import CheckoutForm from '@/components/CheckoutForm';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

export default function HomePage() {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [lobbyId, setLobbyId] = useState<string | null>(null);
  const [chargeAmount, setChargeAmount] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const startBogoSplit = async () => {
    const res = await fetch('/api/create-lobby', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemPrice: 100 }),
    });
    const data = await res.json();
    if (data.error) {
      alert(data.error);
      return;
    }
    setClientSecret(data.clientSecret);
    setLobbyId(data.lobbyId);
    setChargeAmount(data.chargeAmount);
  };

  const handlePaymentSuccess = () => {
    if (lobbyId) {
      const url = `${window.location.origin}/lobby/${lobbyId}`;
      setShareUrl(url);
    }
  };

  return (
    <main className="max-w-xl mx-auto p-6 my-10 bg-white rounded-xl shadow-lg border border-gray-100 font-sans">
      <div className="border-b pb-4 mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Pro Runner Sneakers</h1>
        <p className="text-gray-500">Retail Price: $100.00 — BOGO Promotion Active</p>
      </div>

      {!clientSecret && !shareUrl && (
        <div className="border p-5 rounded-xl bg-emerald-50 border-emerald-200">
          <div className="flex justify-between items-center mb-3">
            <div>
              <span className="font-bold text-emerald-900 text-lg">Split BOGO Deal</span>
              <p className="text-xs text-emerald-700">Find a partner & each pay half + fees!</p>
            </div>
            <span className="bg-emerald-600 text-white text-sm font-bold px-3 py-1.5 rounded-full">$54.32 Total</span>
          </div>
          <button
            onClick={startBogoSplit}
            className="w-full bg-emerald-600 text-white font-semibold py-3 rounded-lg hover:bg-emerald-700 transition"
          >
            Start a BOGO Split Lobby
          </button>
        </div>
      )}

      {clientSecret && !shareUrl && (
        <div className="mt-6 border-t pt-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-1">Pre-authorize Your Share (${chargeAmount})</h2>
          <p className="text-xs text-gray-500 mb-4">Funds are held on your card and only charged once a partner joins.</p>
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <CheckoutForm onSuccess={handlePaymentSuccess} buttonText={`Hold $${chargeAmount} & Create Lobby`} />
          </Elements>
        </div>
      )}

      {shareUrl && (
        <div className="mt-6 p-5 bg-emerald-50 rounded-xl border border-emerald-300 text-center space-y-3">
          <h2 className="text-xl font-bold text-emerald-900">🎉 Lobby Created!</h2>
          <p className="text-sm text-emerald-800">Your $54.32 hold is active. Send this link to a friend to complete the deal:</p>
          <input
            readOnly
            value={shareUrl}
            className="w-full p-2.5 border rounded-lg text-sm text-center font-mono bg-white select-all text-gray-800"
          />
          <button
            onClick={() => navigator.clipboard.writeText(shareUrl)}
            className="bg-emerald-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-emerald-800 transition"
          >
            Copy Link
          </button>
        </div>
      )}
    </main>
  );
}
