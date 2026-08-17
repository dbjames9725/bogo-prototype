'use client';

import React, { useState, useEffect, use } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import CheckoutForm from '@/components/CheckoutForm';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

export default function LobbyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [lobby, setLobby] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submittingAddress, setSubmittingAddress] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Stripe State (Starts strictly null)
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [chargeAmount, setChargeAmount] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [shippingLabelUrl, setShippingLabelUrl] = useState<string | null>(null);
  const [trackingNumber, setTrackingNumber] = useState<string | null>(null);

  // User B Address Form State
  const [address, setAddress] = useState({
    name: '',
    street1: '',
    city: '',
    state: '',
    zip: '',
  });

  // Fetch basic lobby info ONLY
  useEffect(() => {
    fetch(`/api/lobby/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setLobby(data);
        if (data.status === 'COMPLETED') {
          setIsCompleted(true);
          setShippingLabelUrl(data.shippingLabelUrl || null);
          setTrackingNumber(data.trackingNumber || null);
        }
        setLoading(false);
      })
      .catch(() => {
        setErrorMsg('Failed to load lobby details.');
        setLoading(false);
      });
  }, [id]);

  // Step 1 Submit handler: Validates address & creates User B PaymentIntent
  const handleAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!address.name || !address.street1 || !address.city || !address.state || !address.zip) {
      setErrorMsg('Please complete all delivery address fields.');
      return;
    }

    setSubmittingAddress(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/join-lobby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lobbyId: id,
          userBAddress: address,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to initialize payment');
      }

      // Populate clientSecret ONLY after address is saved successfully
      setClientSecret(data.clientSecret);
      setChargeAmount(data.chargeAmount);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmittingAddress(false);
    }
  };

  const handleUserBPaymentSuccess = async () => {
    try {
      const res = await fetch('/api/confirm-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lobbyId: id }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to capture lobby payments');
      }

      setIsCompleted(true);
      if (data.shippingLabelUrl) setShippingLabelUrl(data.shippingLabelUrl);
      if (data.trackingNumber) setTrackingNumber(data.trackingNumber);
    } catch (err: any) {
      alert(`Confirmation Error: ${err.message}`);
    }
  };

  if (loading) return <div className="p-10 text-center font-sans">Loading Lobby...</div>;
  if (!lobby || lobby.error) return <div className="p-10 text-center font-sans text-red-500">Lobby not found or expired!</div>;

  const totalItemPrice = Number(lobby.itemPrice || 0);
  const partnerSplit = totalItemPrice / 2;
  const partnerChargeDisplay = chargeAmount || ((partnerSplit + (totalItemPrice * 0.05 / 2) + 1.82)).toFixed(2);

  return (
    <main className="max-w-xl mx-auto p-6 my-10 bg-white rounded-xl shadow-lg border border-gray-100 font-sans">
      <div className="border-b pb-4 mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Join BOGO Split Deal</h1>
        <p className="text-gray-500">
          Item: <strong>{lobby.itemName || 'BOGO Offer Item'}</strong> (${totalItemPrice.toFixed(2)} Retail Value)
        </p>
      </div>

      {errorMsg && (
        <div className="p-3 mb-4 bg-red-100 text-red-800 text-sm rounded-lg border border-red-300">
          ⚠️ {errorMsg}
        </div>
      )}

      {isCompleted ? (
        <div className="p-6 bg-emerald-50 rounded-xl border border-emerald-200 text-center space-y-4">
          <h2 className="text-2xl font-bold text-emerald-900">🎉 BOGO Split Complete!</h2>
          <p className="text-emerald-800 text-sm">Both payments captured! Your orders are confirmed.</p>
         
          {shippingLabelUrl && (
            <div className="pt-2">
              <a
                href={shippingLabelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-emerald-600 text-white font-semibold py-2.5 px-5 rounded-lg hover:bg-emerald-700 transition shadow-sm text-sm"
              >
                📄 Download Prepaid Shipping Label
              </a>
              {trackingNumber && (
                <p className="text-xs text-gray-500 mt-2">
                  Tracking Code: <strong className="font-mono">{trackingNumber}</strong>
                </p>
              )}
            </div>
          )}
        </div>
      ) : !clientSecret ? (
        /* STEP 1: MANDATORY SHIPPING FORM (Renders whenever clientSecret is null) */
        <form onSubmit={handleAddressSubmit} className="space-y-4 border p-5 rounded-xl bg-blue-50 border-blue-200">
          <div className="bg-blue-600 text-white text-xs font-bold px-2.5 py-1 rounded w-fit tracking-wide uppercase mb-2">
            Step 1 of 2: Shipping Address
          </div>

          <p className="text-sm text-blue-900 font-medium">
            Claim your 50% split for <strong>${partnerChargeDisplay}</strong>. Enter your delivery address so Host knows where to ship your item:
          </p>

          <div className="bg-white p-4 rounded-lg border border-blue-200 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={address.name}
                placeholder="Jane Doe"
                className="w-full p-2.5 border rounded-lg text-sm border-gray-300 text-gray-800 bg-white"
                onChange={(e) => setAddress({ ...address, name: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Street Address</label>
              <input
                type="text"
                required
                value={address.street1}
                placeholder="123 Main St, Apt 4B"
                className="w-full p-2.5 border rounded-lg text-sm border-gray-300 text-gray-800 bg-white"
                onChange={(e) => setAddress({ ...address, street1: e.target.value })}
              />
            </div>

            <div className="flex gap-2">
              <div className="w-1/2">
                <label className="block text-xs font-semibold text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  required
                  value={address.city}
                  placeholder="Austin"
                  className="w-full p-2.5 border rounded-lg text-sm border-gray-300 text-gray-800 bg-white"
                  onChange={(e) => setAddress({ ...address, city: e.target.value })}
                />
              </div>
              <div className="w-1/4">
                <label className="block text-xs font-semibold text-gray-700 mb-1">State</label>
                <input
                  type="text"
                  required
                  value={address.state}
                  placeholder="TX"
                  className="w-full p-2.5 border rounded-lg text-sm border-gray-300 text-gray-800 bg-white"
                  onChange={(e) => setAddress({ ...address, state: e.target.value })}
                />
              </div>
              <div className="w-1/4">
                <label className="block text-xs font-semibold text-gray-700 mb-1">ZIP Code</label>
                <input
                  type="text"
                  required
                  value={address.zip}
                  placeholder="78701"
                  className="w-full p-2.5 border rounded-lg text-sm border-gray-300 text-gray-800 bg-white"
                  onChange={(e) => setAddress({ ...address, zip: e.target.value })}
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={submittingAddress}
            className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 cursor-pointer"
          >
            {submittingAddress ? 'Saving Address...' : `Save Address & Continue to Payment ($${partnerChargeDisplay})`}
          </button>
        </form>
      ) : (
        /* STEP 2: STRIPE FORM (Appears ONLY after clientSecret is set via form submit) */
        <div className="mt-4 min-h-[250px]">
          <div className="bg-emerald-600 text-white text-xs font-bold px-2.5 py-1 rounded w-fit tracking-wide uppercase mb-3">
            Step 2 of 2: Complete Payment
          </div>

          <div className="mb-4 p-3 bg-gray-50 border rounded-lg text-xs text-gray-600 flex justify-between items-center">
            <div>
              📍 <strong>Delivery Address:</strong> {address.name}, {address.street1}, {address.city}, {address.state} {address.zip}
            </div>
            <button
              type="button"
              onClick={() => setClientSecret(null)}
              className="text-blue-600 underline font-medium cursor-pointer"
            >
              Edit Address
            </button>
          </div>

          <h2 className="text-lg font-semibold mb-2 text-gray-800">Authorize Payment (${chargeAmount})</h2>
          <Elements key={clientSecret} stripe={stripePromise} options={{ clientSecret }}>
            <CheckoutForm onSuccess={handleUserBPaymentSuccess} buttonText={`Pay $${chargeAmount} & Finalize Order`} />
          </Elements>
        </div>
      )}
    </main>
  );
}

