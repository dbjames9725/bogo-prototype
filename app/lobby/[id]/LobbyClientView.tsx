'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

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

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setErrorMessage(submitError.message || 'Payment submission failed.');
      setLoading(false);
      return;
    }

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
      const isHost = role === 'HOST';
      const addressData = { name, street1: street, city, state, zip, phone };

      const updateData = isHost
        ? { host_payment_intent_id: paymentIntent.id, user_a_address: addressData }
        : { partner_payment_intent_id: paymentIntent.id, user_b_address: addressData };

      await supabase.from('lobbies').update(updateData).eq('id', lobbyId);

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
      <div className="bg-blue-100 text-blue-900 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider">
        Step 1: Enter Payment Info & Shipping Address ({role})
      </div>
      <h3 className="font-bold text-gray-900 text-base">
        {role === 'HOST' ? 'Authorize Your Host Payment Hold' : 'Authorize Your Split Share Payment'}
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
          placeholder="Phone Number (for shipping updates)"
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

export default function LobbyClientView({
  lobbyId,
  initialLobby,
}: {
  lobbyId: string;
  initialLobby: any;
}) {
  const [lobby, setLobby] = useState<any>(initialLobby);
  const [copied, setCopied] = useState(false);
  const [clientSecret, setClientSecret] = useState('');
  const [loadingSecret, setLoadingSecret] = useState(true);

  const shareableUrl = typeof window !== 'undefined' ? `${window.location.origin}/lobby/${lobbyId}` : '';

  useEffect(() => {
    async function setupPaymentIntent() {
      if (!lobby) return;

      if (lobby.status !== 'MATCHED') {
        const isHostPending = !lobby.host_payment_intent_id;
        const role = isHostPending ? 'HOST' : 'PARTNER';
        const shareAmount = role === 'HOST' ? lobby.user_a_share : lobby.user_b_share;

        try {
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
        } catch (err) {
          console.error('Payment intent initialization failed:', err);
        } finally {
          setLoadingSecret(false);
        }
      } else {
        setLoadingSecret(false);
      }
    }

    setupPaymentIntent();

    // Subscribe to real-time updates for live match status
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
  }, [lobbyId, lobby?.id]);

  const copyToClipboard = () => {
    if (shareableUrl) {
      navigator.clipboard.writeText(shareableUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  if (!lobby) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white rounded-2xl shadow border text-center space-y-3">
        <h2 className="text-xl font-bold text-red-600">Lobby Not Found</h2>
        <p className="text-sm text-gray-600">This deal lobby may have expired or does not exist.</p>
        <a href="/" className="inline-block bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-lg">
          Back to Homepage
        </a>
      </div>
    );
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

      {/* Breakdown */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm text-gray-700">
        <div className="flex justify-between">
          <span>Deal Type:</span>
          <span className="font-semibold text-gray-900">
            {lobby.deal_type === 'BOGO_50' ? 'Buy 1 Get 1 50% OFF' : 'Buy 1 Get 1 FREE'}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Total Price (with Tax):</span>
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

      {/* Payment Intent Initializing Spinner */}
      {loadingSecret && lobby.status !== 'MATCHED' && (
        <div className="p-8 text-center bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <p className="text-sm font-semibold text-gray-700">Setting up secure Stripe checkout...</p>
        </div>
      )}

      {/* Stripe Payment Form */}
      {!loadingSecret && lobby.status !== 'MATCHED' && clientSecret && (isHostPendingHold || isPartnerPendingHold) && (
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <CheckoutForm
            lobbyId={lobbyId}
            role={isHostPendingHold ? 'HOST' : 'PARTNER'}
            onSuccess={() => {
              window.location.reload();
            }}
          />
        </Elements>
      )}

      {/* Invite Box (Shows ONLY after Host has completed payment authorization) */}
      {!loadingSecret && lobby.status !== 'MATCHED' && lobby.host_payment_intent_id && !lobby.partner_payment_intent_id && (
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
              <p className="text-xs text-blue-700">Host payment authorized! Send this link to your partner.</p>
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
