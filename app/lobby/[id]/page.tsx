'use client';

import React, { useState, useEffect, use } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import CheckoutForm from '@/components/CheckoutForm';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

export default function LobbyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [lobby, setLobby] = useState<any>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [chargeAmount, setChargeAmount] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/lobby/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setLobby(data);
        if (data.status === 'COMPLETED') {
          setIsCompleted(true);
        }
        setLoading(false);
      })
      .catch(() => {
        setErrorMsg('Failed to load lobby details.');
        setLoading(false);
      });
  }, [id]);

  const joinLobby = async () => {
    setJoining(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/join-lobby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lobbyId: id }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to join lobby');
      }
      setClientSecret(data.clientSecret);
      setChargeAmount(data.chargeAmount);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setJoining(false);
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
        <div className="p-6 bg-emerald-50 rounded-xl border border-emerald-200 text-center space-y-2">
          <h2 className="text-2xl font-bold text-emerald-900">🎉 BOGO Split Complete!</h2>
          <p className="text-emerald-800">Both payments have been captured successfully. Your orders are confirmed!</p>
        </div>
      ) : (
        <>
          {!clientSecret ? (
            <div className="border p-5 rounded-xl bg-blue-50 border-blue-200">
              <p className="text-sm text-blue-900 mb-4 font-medium">
                User A is waiting for a BOGO partner! Pay <strong>${partnerChargeDisplay}</strong> (50% split + fees) to claim your half.
              </p>
              <button
                onClick={joinLobby}
                disabled={joining}
                className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {joining ? 'Joining Lobby...' : `Join Split & Pay $${partnerChargeDisplay}`}
              </button>
            </div>
          ) : (
            <div className="mt-4 min-h-[250px]">
              <h2 className="text-lg font-semibold mb-2 text-gray-800">Complete Your Payment (${chargeAmount})</h2>
              <Elements key={clientSecret} stripe={stripePromise} options={{ clientSecret }}>
                <CheckoutForm onSuccess={handleUserBPaymentSuccess} buttonText={`Pay $${chargeAmount} & Finalize Order`} />
              </Elements>
            </div>
          )}
        </>
      )}
    </main>
  );
}

