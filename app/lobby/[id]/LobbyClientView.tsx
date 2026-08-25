'use client';

import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { supabase } from '@/lib/supabase';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface LobbyData {
  id: string;
  item_name: string;
  item_price: number;
  total_price: number;
  deal_type: string;
  user_a_share: number;
  user_b_share: number;
  status: string;
  host_payment_intent_id?: string;
  partner_payment_intent_id?: string;
  user_a_variant?: any;
  user_b_variant?: any;
}

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

  const [name, setName] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [phone, setPhone] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    setLoading(true);
    setErrorMessage('');

    try {
      // 1. Confirm Payment Hold with Stripe
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: 'if_required',
      });

      if (error) {
        setErrorMessage(error.message || 'Payment authorization failed');
        setLoading(false);
        return;
      }

      if (paymentIntent && (paymentIntent.status === 'requires_capture' || paymentIntent.status === 'succeeded')) {
        const isHost = role === 'HOST';
        const addressData = { name, street1: street, city, state, zip, phone };

        // 2. FORCE write payment_intent_id and address to Supabase
        const updateData = isHost
          ? { host_payment_intent_id: paymentIntent.id, user_a_address: addressData }
          : { partner_payment_intent_id: paymentIntent.id, user_b_address: addressData };

        const { error: dbError } = await supabase
          .from('lobbies')
          .update(updateData)
          .eq('id', lobbyId);

        if (dbError) {
          throw new Error('Failed to update lobby details in database: ' + dbError.message);
        }

        if (isHost && typeof window !== 'undefined') {
          localStorage.setItem(`hosted_${lobbyId}`, 'true');
        }

        // 3. Trigger Dual Capture if Partner completes authorization
        if (!isHost) {
          const confirmRes = await fetch('/api/confirm-match', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lobbyId }),
          });

          const confirmData = await confirmRes.json();

          if (!confirmRes.ok) {
            throw new Error(confirmData.error || 'Failed to capture matched payments');
          }
        }

        onSuccess();
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      setErrorMessage(err.message || 'An unexpected error occurred during checkout');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-gray-50 p-4 rounded-xl space-y-3 border border-gray-200">
        <h4 className="text-xs font-bold uppercase text-gray-500 tracking-wider">Shipping & Billing Address</h4>
        <input
          type="text"
          placeholder="Full Name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-2.5 text-sm border rounded-lg bg-white"
        />
        <input
          type="text"
          placeholder="Street Address"
          required
          value={street}
          onChange={(e) => setStreet(e.target.value)}
          className="w-full p-2.5 text-sm border rounded-lg bg-white"
        />
        <div className="grid grid-cols-3 gap-2">
          <input
            type="text"
            placeholder="City"
            required
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="p-2.5 text-sm border rounded-lg bg-white"
          />
          <input
            type="text"
            placeholder="State"
            required
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="p-2.5 text-sm border rounded-lg bg-white"
          />
          <input
            type="text"
            placeholder="ZIP Code"
            required
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            className="p-2.5 text-sm border rounded-lg bg-white"
          />
        </div>
        <input
          type="tel"
          placeholder="Phone Number"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full p-2.5 text-sm border rounded-lg bg-white"
        />
      </div>

      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
        <h4 className="text-xs font-bold uppercase text-gray-500 tracking-wider mb-3">Payment Method</h4>
        <PaymentElement />
      </div>

      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-semibold">
          ⚠️ {errorMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg transition disabled:opacity-50 text-base"
      >
        {loading ? 'Authorizing Hold...' : `Authorize Payment (${role === 'HOST' ? 'Host' : 'Partner'} Share)`}
      </button>
    </form>
  );
}

export default function LobbyClientView({ lobbyId }: { lobbyId: string }) {
  const [lobby, setLobby] = useState<LobbyData | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [role, setRole] = useState<'HOST' | 'PARTNER'>('PARTNER');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchLobby = async () => {
    const { data, error } = await supabase
      .from('lobbies')
      .select('*')
      .eq('id', lobbyId)
      .single();

    if (error || !data) {
      console.error('Error fetching lobby:', error);
      setLoading(false);
      return;
    }

    setLobby(data);

    const isHost = typeof window !== 'undefined' && localStorage.getItem(`hosted_${lobbyId}`) === 'true';
    const currentRole = isHost ? 'HOST' : 'PARTNER';
    setRole(currentRole);

    const hasPaid = isHost ? !!data.host_payment_intent_id : !!data.partner_payment_intent_id;

    if (!hasPaid && data.status !== 'MATCHED') {
      try {
        const res = await fetch('/api/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lobbyId, role: currentRole }),
        });
        const intentData = await res.json();
       
        if (intentData.clientSecret && intentData.paymentIntentId) {
          setClientSecret(intentData.clientSecret);
         
          // Immediately record generated payment intent ID to Supabase
          const updateCol = currentRole === 'HOST'
            ? { host_payment_intent_id: intentData.paymentIntentId }
            : { partner_payment_intent_id: intentData.paymentIntentId };
           
          await supabase.from('lobbies').update(updateCol).eq('id', lobbyId);
        }
      } catch (err) {
        console.error('Failed creating PaymentIntent:', err);
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchLobby();

    const channel = supabase
      .channel(`lobby_${lobbyId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'lobbies', filter: `id=eq.${lobbyId}` },
        (payload) => {
          setLobby(payload.new as LobbyData);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [lobbyId]);

  const copyInviteLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  if (loading || !lobby) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500 font-sans">
        <div className="flex items-center gap-3 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="font-semibold text-sm">Loading BOGO Split Lobby...</span>
        </div>
      </div>
    );
  }

  const itemPrice = lobby.item_price || 0;
  const baseShare = itemPrice / 2;
  const platformFee = itemPrice * 0.025;
  const stripeFee = baseShare * 0.029 + 0.30;
  const totalShare = baseShare + platformFee + stripeFee;

  const isHost = role === 'HOST';
  const hasHostPaid = !!lobby.host_payment_intent_id;
  const hasPartnerPaid = !!lobby.partner_payment_intent_id;
  const isMatched = lobby.status === 'MATCHED';

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 font-sans text-gray-900">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex items-center justify-between">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">
              {isHost ? '👑 HOST DASHBOARD' : '🤝 PARTNER DEAL INVITATION'}
            </span>
            <h2 className="text-xl font-extrabold mt-2">{lobby.item_name}</h2>
          </div>
          <div className="text-right">
            <span className="text-xs text-gray-400 block font-semibold">Deal Type</span>
            <span className="text-sm font-bold text-gray-700">{lobby.deal_type}</span>
          </div>
        </div>

        {isMatched ? (
          <div className="bg-emerald-600 text-white p-6 rounded-3xl shadow-lg space-y-2 text-center">
            <div className="text-4xl">🎉</div>
            <h3 className="text-2xl font-black">MATCH CONFIRMED & PAYMENTS CAPTURED!</h3>
            <p className="text-xs text-emerald-100">
              Both pre-authorizations were captured successfully. The merchant will process and ship your split order!
            </p>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-3xl shadow-md border border-gray-200 space-y-4">
            <h3 className="text-base font-extrabold border-b border-gray-100 pb-3">Price Breakdown (Per Person)</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Original Item Price</span>
                <span className="font-semibold">${itemPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>50/50 Base Share</span>
                <span className="font-semibold">${baseShare.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>2.5% Platform Fee</span>
                <span className="font-semibold">+${platformFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Stripe Processing Fee</span>
                <span className="font-semibold">+${stripeFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-black text-gray-900 pt-2 border-t border-gray-100">
                <span>Total Amount Due</span>
                <span className="text-blue-600">${totalShare.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        {isHost && hasHostPaid && !isMatched && (
          <div className="bg-blue-50 border border-blue-200 p-6 rounded-3xl space-y-3">
            <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
              <span>🔗 Share Invite Link With a Partner</span>
            </div>
            <p className="text-xs text-blue-700">
              Your payment hold is placed! Share this link with a friend or social group to split the BOGO deal.
            </p>
            <button
              onClick={copyInviteLink}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition shadow-sm"
            >
              {copied ? '✓ Invite Link Copied!' : 'Copy Invite Link'}
            </button>
          </div>
        )}

        {!isMatched && (
          <div className="bg-white p-6 rounded-3xl shadow-md border border-gray-200 space-y-4">
            {((isHost && !hasHostPaid) || (!isHost && !hasPartnerPaid)) ? (
              <>
                <h3 className="text-lg font-extrabold text-gray-900 border-b border-gray-100 pb-3">
                  {isHost ? 'Authorize Host Payment Hold' : 'Join Deal & Authorize Your Split Share'}
                </h3>
                {clientSecret ? (
                  <Elements stripe={stripePromise} options={{ clientSecret }}>
                    <CheckoutForm lobbyId={lobbyId} role={role} onSuccess={fetchLobby} />
                  </Elements>
                ) : (
                  <div className="py-6 text-center text-xs font-semibold text-gray-500">
                    Preparing secure Stripe checkout...
                  </div>
                )}
              </>
            ) : (
              <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl text-xs font-semibold text-center space-y-1">
                <div>⏳ Waiting for {isHost ? 'Partner' : 'Host'} to authorize their share...</div>
                <div className="text-[11px] font-normal text-amber-700">
                  Neither card is charged until both pre-authorizations succeed.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


