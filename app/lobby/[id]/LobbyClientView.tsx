'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

// Inner Checkout Form Component
function CheckoutForm({
  lobbyId,
  role,
  onSuccess,
}: {
  lobbyId: string;
  role: 'HOST' | 'PARTNER';
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Shipping Address Form Inputs
  const [name, setName] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('CA');
  const [zip, setZip] = useState('');
  const [phone, setPhone] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setErrorMessage('');

    // 1. Submit Payment Element
    const { error: submitError } = await elements.submit();
    if (submitError) {
      setErrorMessage(submitError.message || 'Payment submission failed.');
      setLoading(false);
      return;
    }

    // 2. Confirm Payment Intent (Hold Funds)
    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: 'if_required',
    });

    if (confirmError) {
      setErrorMessage(confirmError.message || 'Payment confirmation failed.');
      setLoading(false);
      return;
    }

    if (paymentIntent && paymentIntent.status === 'requires_capture') {
      // 3. Save Payment Intent ID & Address in Supabase
      const isHost = role === 'HOST';
      const addressData = { name, street1: street, city, state, zip, phone };

      const updateData = isHost
        ? { host_payment_intent_id: paymentIntent.id, user_a_address: addressData }
        : { partner_payment_intent_id: paymentIntent.id, user_b_address: addressData };

      await supabase.from('lobbies').update(updateData).eq('id', lobbyId);

      // 4. If this is Partner (User B), trigger final match confirmation API
      if (!isHost) {
        await fetch('/api/confirm-match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lobbyId }),
        });
      }

      onSuccess();
    }

    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-gray-50 p-5 rounded-2xl border border-gray-200">
      <h3 className="font-bold text-gray-900 text-base">
        {role === 'HOST' ? '1. Authorize Your Host Payment Hold' : 'Authorize Your Split Share Payment'}
      </h3>
      <p className="text-xs text-gray-500">
        Funds are authorized on hold and only captured when both parties complete checkout.
      </p>

      <div className="space-y-3">
        <input
          type="text"
          required
          placeholder="Full Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
        />
        <input
          type="text"
          required
          placeholder="Street Address"
          value={street}
          onChange={(e) => setStreet(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
        />
        <div className="grid grid-cols-3 gap-2">
          <input
            type="text"
            required
            placeholder="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm bg-white"
          />
          <input
            type="text"
            required
            placeholder="State (e.g. CA)"
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm bg-white uppercase"
          />
          <input
            type="text"
            required
            placeholder="ZIP Code"
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm bg-white"
          />
        </div>
        <input
          type="tel"
          placeholder="Phone Number (for shipping/SMS alerts)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
        />
      </div>

      <div className="pt-2">
        <PaymentElement />
      </div>

      {errorMessage && <div className="text-xs text-red-600 font-semibold">{errorMessage}</div>}

      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl shadow transition text-sm"
      >
        {loading ? 'Processing Hold...' : `Authorize Payment (${role === 'HOST' ? 'Host Share' : 'Partner Share'})`}
      </button>
    </form>
  );
}

// Main Client View Component
export default function LobbyClientView({ lobbyId }: { lobbyId: string }) {
  const [lobby, setLobby] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [clientSecret, setClientSecret] = useState('');
  const [userRole, setUserRole] = useState<'HOST' | 'PARTNER'>('PARTNER');

  const shareableUrl = typeof window !== 'undefined' ? `${window.location.origin}/lobby/${lobbyId}` : '';

  useEffect(() => {
    async function init() {
      const { data, error } = await supabase.from('lobbies').select('*').eq('id', lobbyId).single();

      if (!error && data) {
        setLobby(data);

        // Determine if current user is Host or Partner based on existing payment holds
        const isHost = !data.host_payment_intent_id;
        const role = isHost ? 'HOST' : 'PARTNER';
        setUserRole(role);

        // Request Stripe Payment Intent Client Secret if checkout is pending
        if (data.status !== 'MATCHED') {
          const shareAmount = role === 'HOST' ? data.user_a_share : data.user_b_share;

          const res = await fetch('/api/create-payment-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              amount: shareAmount,
              lobbyId,
              role,
            }),
          });
          const intentData = await res.json();
          if (intentData.clientSecret) {
            setClientSecret(intentData.clientSecret);
          }
        }
      }
      setLoading(false);
    }

    init();

    // Subscribe to Realtime Updates
    const channel = supabase
      .channel(`lobby-${lobbyId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'lobbies', filter: `id=eq.${lobbyId}` },
        (payload) => {
          setLobby(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [lobbyId]);

  const copyToClipboard = () => {
    if (shareableUrl) {
      navigator.clipboard.writeText(shareableUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading lobby details...</div>;
  }

  if (!lobby) {
    return <div className="text-center py-12 text-red-500">Lobby not found.</div>;
  }

  const isHostPendingHold = !lobby.host_payment_intent_id;
  const isPartnerPendingHold = lobby.host_payment_intent_id && !lobby.partner_payment_intent_id;

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 bg-white rounded-2xl shadow-sm border border-gray-200 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b border-gray-100">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{lobby.item_name}</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Lobby ID: <span className="font-mono">{lobbyId}</span>
          </p>
        </div>
        <span
          className={`px-3 py-1 text-xs font-bold rounded-full ${
            lobby.status === 'MATCHED'
              ? 'bg-green-100 text-green-800 border border-green-300'
              : 'bg-amber-100 text-amber-800 border border-amber-300'
          }`}
        >
          {lobby.status === 'MATCHED' ? '🎉 MATCH CONFIRMED' : '⏳ Awaiting Partner'}
        </span>
      </div>

      {/* Cost Breakdown */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm text-gray-700">
        <div className="flex justify-between">
          <span>Deal Type:</span>
          <span className="font-semibold text-gray-900">
            {lobby.deal_type === 'BOGO_50' ? 'Buy 1 Get 1 50% OFF' : 'Buy 1 Get 1 FREE'}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Total Item Price (with Tax):</span>
          <span className="font-semibold text-gray-900">${lobby.item_price?.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Host Share:</span>
          <span className="font-semibold text-blue-600">${lobby.user_a_share?.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Partner Share:</span>
          <span className="font-semibold text-emerald-600">${lobby.user_b_share?.toFixed(2)}</span>
        </div>
      </div>

      {/* Checkout Form Container */}
      {lobby.status !== 'MATCHED' && clientSecret && (isHostPendingHold || isPartnerPendingHold) && (
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <CheckoutForm
            lobbyId={lobbyId}
            role={isHostPendingHold ? 'HOST' : 'PARTNER'}
            onSuccess={() => {
              // Refresh state
              window.location.reload();
            }}
          />
        </Elements>
      )}

      {/* Share Box (Visible when Host has authorized hold and is waiting for partner) */}
      {lobby.status !== 'MATCHED' && lobby.host_payment_intent_id && !lobby.partner_payment_intent_id && (
        <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 text-white rounded-xl">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-blue-950 text-base">Share Partner Invite Link</h3>
              <p className="text-xs text-blue-700">Send this link to a partner so they can authorize payment.</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              readOnly
              value={shareableUrl}
              className="w-full bg-white border border-blue-200 rounded-xl px-3 py-2.5 text-xs text-gray-700 font-mono focus:outline-none"
            />
            <button
              type="button"
              onClick={copyToClipboard}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition shadow-sm whitespace-nowrap flex items-center justify-center gap-1.5"
            >
              {copied ? '✓ Link Copied!' : 'Copy Invite Link'}
            </button>
          </div>
        </div>
      )}

      {/* MATCHED State */}
      {lobby.status === 'MATCHED' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-4">
          <div className="text-3xl">🎉</div>
          <h2 className="text-xl font-bold text-emerald-950">Match Confirmed & Payment Captured!</h2>
          <p className="text-sm text-emerald-800">
            Both payment authorizations succeeded. Download the return shipping label below:
          </p>
          {lobby.shipping_label_url && (
            <a
              href={lobby.shipping_label_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-xl shadow transition text-sm"
            >
              Download Shipping Label
            </a>
          )}
          {lobby.tracking_code && (
            <p className="text-xs text-gray-600">
              Tracking Code: <span className="font-mono font-semibold">{lobby.tracking_code}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
