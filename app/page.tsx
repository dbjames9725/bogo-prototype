'use client';

import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import CheckoutForm from '@/components/CheckoutForm';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

export default function HomePage() {
  const [itemPrice, setItemPrice] = useState<number>(100);
  const [itemName, setItemName] = useState<string>('BOGO Offer Item');
 
  // Deal Type State: 'BOGO_FREE' (Buy 1 Get 1 Free) vs 'BOGO_50' (Buy 1 Get 1 50% Off)
  const [dealType, setDealType] = useState<'BOGO_FREE' | 'BOGO_50'>('BOGO_FREE');

  // Host Return Address State
  const [address, setAddress] = useState({
    name: '',
    street1: '',
    city: '',
    state: '',
    zip: '',
  });

  const [loading, setLoading] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [chargeAmount, setChargeAmount] = useState<string | null>(null);
  const [lobbyId, setLobbyId] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Math helper for displaying estimated split price before creation
  const calculatedCartTotal = dealType === 'BOGO_50' ? itemPrice * 1.5 : itemPrice;
  const estimatedSplitShare = (calculatedCartTotal / 2).toFixed(2);

  async function handleCreateLobbyIntent() {
    if (!itemPrice || itemPrice <= 0) {
      setError('Please enter a valid item price.');
      return;
    }
    if (!address.street1 || !address.city || !address.state || !address.zip) {
      setError('Please complete your return shipping address.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/create-lobby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemPrice: Number(itemPrice),
          itemName: itemName || 'BOGO Offer Item',
          dealType, // Pass selected deal type to backend
          userAAddress: address,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to create lobby');
      }

      setClientSecret(data.clientSecret);
      setChargeAmount(data.chargeAmount);
      setLobbyId(data.lobbyId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleHostPaymentSuccess = async () => {
    setIsAuthorized(true);
  };

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/lobby/${lobbyId}` : '';

  return (
    <main className="max-w-xl mx-auto p-6 my-10 bg-white rounded-xl shadow-lg border border-gray-100 font-sans">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">BOGO Split Offer</h1>
      <p className="text-gray-500 mb-6">Split any BOGO deal 50/50 with a verified partner!</p>

      {error && (
        <div className="p-3 mb-4 bg-red-100 text-red-800 text-sm rounded-lg border border-red-300">
          ⚠️ {error}
        </div>
      )}

      {!clientSecret ? (
        <div className="space-y-4">
          {/* Deal Type Selection Toggle */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Select Promotion Type:</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDealType('BOGO_FREE')}
                className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold border transition ${
                  dealType === 'BOGO_FREE'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                }`}
              >
                Buy 1 Get 1 FREE
                <span className="block font-normal text-[10px] opacity-80 mt-0.5">50% Off Each Person</span>
              </button>
              <button
                type="button"
                onClick={() => setDealType('BOGO_50')}
                className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold border transition ${
                  dealType === 'BOGO_50'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                }`}
              >
                Buy 1 Get 1 50% OFF
                <span className="block font-normal text-[10px] opacity-80 mt-0.5">25% Off Each Person</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Item Name:</label>
            <input
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g. Pro Runner Sneakers"
              className="w-full p-2.5 border rounded-lg text-gray-800 border-gray-300"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Single Item Retail Price ($):</label>
            <input
              type="number"
              min="1"
              step="0.01"
              value={itemPrice}
              onChange={(e) => setItemPrice(Number(e.target.value))}
              className="w-full p-2.5 border rounded-lg text-gray-800 border-gray-300"
            />
            <p className="text-xs text-blue-600 mt-1 font-medium">
              💡 Estimated split share: <strong>${estimatedSplitShare}</strong> per person (+ platform & processing fee)
            </p>
          </div>

          <div className="flex gap-2">
            {[50, 75, 100, 150, 200].map((price) => (
              <button
                key={price}
                type="button"
                onClick={() => setItemPrice(price)}
                className={`px-3 py-1.5 text-sm rounded-md border ${
                  itemPrice === price ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-blue-600 border-gray-200'
                }`}
              >
                ${price}
              </button>
            ))}
          </div>

          {/* Host Return Address Section */}
          <div className="pt-4 border-t border-gray-200 space-y-3">
            <h3 className="font-semibold text-gray-800 text-sm">Your Return Shipping Address (Where you are shipping from):</h3>
            <input
              type="text"
              placeholder="Full Name"
              className="w-full p-2.5 border rounded-lg text-sm border-gray-300"
              onChange={(e) => setAddress({ ...address, name: e.target.value })}
            />
            <input
              type="text"
              placeholder="Street Address"
              className="w-full p-2.5 border rounded-lg text-sm border-gray-300"
              onChange={(e) => setAddress({ ...address, street1: e.target.value })}
            />
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="City"
                className="w-1/2 p-2.5 border rounded-lg text-sm border-gray-300"
                onChange={(e) => setAddress({ ...address, city: e.target.value })}
              />
              <input
                type="text"
                placeholder="State (e.g. CA)"
                className="w-1/4 p-2.5 border rounded-lg text-sm border-gray-300"
                onChange={(e) => setAddress({ ...address, state: e.target.value })}
              />
              <input
                type="text"
                placeholder="ZIP Code"
                className="w-1/4 p-2.5 border rounded-lg text-sm border-gray-300"
                onChange={(e) => setAddress({ ...address, zip: e.target.value })}
              />
            </div>
          </div>

          <button
            onClick={handleCreateLobbyIntent}
            disabled={loading}
            className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 mt-4 cursor-pointer"
          >
            {loading ? 'Initializing Lobby...' : `Start ${dealType === 'BOGO_50' ? 'BOGO 50%' : 'BOGO Free'} Lobby`}
          </button>
        </div>
      ) : !isAuthorized ? (
        <div className="mt-4 min-h-[250px]">
          <h2 className="text-lg font-semibold mb-1 text-gray-800">Authorize Your Share (${chargeAmount})</h2>
          <p className="text-sm text-gray-500 mb-4">You will only be charged if a partner joins and authorizes their share within 24 hours.</p>
          <Elements key={clientSecret} stripe={stripePromise} options={{ clientSecret }}>
            <CheckoutForm onSuccess={handleHostPaymentSuccess} buttonText={`Authorize $${chargeAmount} Hold & Get Share Link`} />
          </Elements>
        </div>
      ) : (
        <div className="p-6 bg-blue-50 rounded-xl border border-blue-200 space-y-4">
          <h2 className="text-xl font-bold text-blue-900">Lobby Created & Payment Authorized! 🎉</h2>
          <p className="text-sm text-blue-800">
            Your payment hold of <strong>${chargeAmount}</strong> is placed. Share this link with your partner:
          </p>
          <input
            readOnly
            value={shareUrl}
            onClick={(e) => (e.target as HTMLInputElement).select()}
            className="w-full p-3 bg-white border border-blue-300 rounded-lg text-gray-800 text-sm font-mono"
          />
        </div>
      )}
    </main>
  );
}

