'use client';

import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { supabase } from '@/lib/supabase';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export interface AddressData {
  name: string;
  street1: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
}

export interface LobbyData {
  id: string;
  item_name: string;
  item_price: number;
  total_price: number;
  deal_type: string;
  status: string;
  host_payment_intent_id?: string;
  partner_payment_intent_id?: string;
  user_a_address?: AddressData;
  user_b_address?: AddressData;
  user_a_variant?: any;
  user_b_variant?: any;
}

// Complete 50 States + DC Average Combined Sales Tax Rates
const STATE_TAX_RATES: Record<string, { name: string; rate: number }> = {
  AL: { name: 'Alabama', rate: 0.0924 },
  AK: { name: 'Alaska', rate: 0.0181 },
  AZ: { name: 'Arizona', rate: 0.0837 },
  AR: { name: 'Arkansas', rate: 0.0944 },
  CA: { name: 'California', rate: 0.0885 },
  CO: { name: 'Colorado', rate: 0.0778 },
  CT: { name: 'Connecticut', rate: 0.0635 },
  DE: { name: 'Delaware', rate: 0.0000 },
  DC: { name: 'District of Columbia', rate: 0.0600 },
  FL: { name: 'Florida', rate: 0.0700 },
  GA: { name: 'Georgia', rate: 0.0738 },
  HI: { name: 'Hawaii', rate: 0.0444 },
  ID: { name: 'Idaho', rate: 0.0603 },
  IL: { name: 'Illinois', rate: 0.0884 },
  IN: { name: 'Indiana', rate: 0.0700 },
  IA: { name: 'Iowa', rate: 0.0694 },
  KS: { name: 'Kansas', rate: 0.0865 },
  KY: { name: 'Kentucky', rate: 0.0600 },
  LA: { name: 'Louisiana', rate: 0.0956 },
  ME: { name: 'Maine', rate: 0.0550 },
  MD: { name: 'Maryland', rate: 0.0600 },
  MA: { name: 'Massachusetts', rate: 0.0625 },
  MI: { name: 'Michigan', rate: 0.0600 },
  MN: { name: 'Minnesota', rate: 0.0803 },
  MS: { name: 'Mississippi', rate: 0.0707 },
  MO: { name: 'Missouri', rate: 0.0833 },
  MT: { name: 'Montana', rate: 0.0000 },
  NE: { name: 'Nebraska', rate: 0.0697 },
  NV: { name: 'Nevada', rate: 0.0823 },
  NH: { name: 'New Hampshire', rate: 0.0000 },
  NJ: { name: 'New Jersey', rate: 0.0660 },
  NM: { name: 'New Mexico', rate: 0.0772 },
  NY: { name: 'New York', rate: 0.0853 },
  NC: { name: 'North Carolina', rate: 0.0698 },
  ND: { name: 'North Dakota', rate: 0.0696 },
  OH: { name: 'Ohio', rate: 0.0724 },
  OK: { name: 'Oklahoma', rate: 0.0899 },
  OR: { name: 'Oregon', rate: 0.0000 },
  PA: { name: 'Pennsylvania', rate: 0.0634 },
  RI: { name: 'Rhode Island', rate: 0.0700 },
  SC: { name: 'South Carolina', rate: 0.0744 },
  SD: { name: 'South Dakota', rate: 0.0611 },
  TN: { name: 'Tennessee', rate: 0.0955 },
  TX: { name: 'Texas', rate: 0.0820 },
  UT: { name: 'Utah', rate: 0.0722 },
  VT: { name: 'Vermont', rate: 0.0636 },
  VA: { name: 'Virginia', rate: 0.0577 },
  WA: { name: 'Washington', rate: 0.0938 },
  WV: { name: 'West Virginia', rate: 0.0657 },
  WI: { name: 'Wisconsin', rate: 0.0543 },
  WY: { name: 'Wyoming', rate: 0.0536 },
};

interface CheckoutFormProps {
  lobbyId: string;
  role: 'HOST' | 'PARTNER';
  onSuccess: () => void;
}

function CheckoutForm({ lobbyId, role, onSuccess }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();

  const [name, setName] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('NY');
  const [zip, setZip] = useState('');
  const [phone, setPhone] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      setErrorMessage('Stripe SDK has not loaded yet. Please wait a moment and try again.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: typeof window !== 'undefined' ? window.location.href : '',
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
        const addressData: AddressData = { name, street1: street, city, state, zip, phone };

        const updateData = isHost
          ? { host_payment_intent_id: paymentIntent.id, user_a_address: addressData }
          : { partner_payment_intent_id: paymentIntent.id, user_b_address: addressData };

        const { error: dbError } = await supabase
          .from('lobbies')
          .update(updateData)
          .eq('id', lobbyId);

        if (dbError) {
          throw new Error('Failed updating database with payment intent: ' + dbError.message);
        }

        if (isHost && typeof window !== 'undefined') {
          localStorage.setItem(`hosted_${lobbyId}`, 'true');
        }

        if (!isHost) {
          await new Promise((res) => setTimeout(res, 300));

          const confirmRes = await fetch('/api/confirm-match', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lobbyId }),
          });

          const confirmData = await confirmRes.json();

          if (!confirmRes.ok) {
            throw new Error(confirmData.error || 'Failed capturing dual payment holds');
          }
        }

        onSuccess();
      } else {
        setErrorMessage('Unexpected payment status. Please try submitting again.');
      }
    } catch (err: any) {
      console.error('Checkout Form Submission Error:', err);
      setErrorMessage(err.message || 'An unexpected error occurred during checkout');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-neutral-900 p-4 rounded-xl space-y-3 border border-neutral-800">
        <h4 className="text-xs font-bold uppercase text-neutral-400 tracking-wider">
          Shipping & Billing Address
        </h4>
        <div>
          <label className="block text-[11px] font-semibold text-neutral-300 mb-1">Full Name</label>
          <input
            type="text"
            placeholder="Jane Doe"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-2.5 text-sm border border-neutral-800 rounded-lg bg-neutral-950 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-neutral-300 mb-1">Street Address</label>
          <input
            type="text"
            placeholder="123 Main St, Apt 4B"
            required
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            className="w-full p-2.5 text-sm border border-neutral-800 rounded-lg bg-neutral-950 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[11px] font-semibold text-neutral-300 mb-1">City</label>
            <input
              type="text"
              placeholder="New York"
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full p-2.5 text-sm border border-neutral-800 rounded-lg bg-neutral-950 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-neutral-300 mb-1">State</label>
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="w-full p-2.5 text-sm border border-neutral-800 rounded-lg bg-neutral-950 text-white font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.keys(STATE_TAX_RATES).sort().map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-neutral-300 mb-1">ZIP Code</label>
            <input
              type="text"
              placeholder="10001"
              required
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              className="w-full p-2.5 text-sm border border-neutral-800 rounded-lg bg-neutral-950 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-neutral-300 mb-1">Phone Number</label>
          <input
            type="tel"
            placeholder="(555) 000-0000"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full p-2.5 text-sm border border-neutral-800 rounded-lg bg-neutral-950 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800">
        <h4 className="text-xs font-bold uppercase text-neutral-400 tracking-wider mb-3">
          Payment Method
        </h4>
        <PaymentElement />
      </div>

      {errorMessage && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg font-semibold">
          ⚠️ {errorMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg transition disabled:opacity-50 text-base cursor-pointer"
      >
        {loading
          ? 'Authorizing Hold...'
          : `Authorize Payment (${role === 'HOST' ? 'Host' : 'Partner'} Share)`}
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
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchLobby = async () => {
    try {
      const { data, error } = await supabase
        .from('lobbies')
        .select('*')
        .eq('id', lobbyId)
        .single();

      if (error || !data) {
        setFetchError('Lobby record not found in database.');
        setLoading(false);
        return;
      }

      setLobby(data);

      // STRICT ROLE DETERMINATION:
      // If host_payment_intent_id is missing, current user MUST be Host.
      // If host_payment_intent_id exists AND partner_payment_intent_id is missing, current user MUST be Partner.
      const isHostStored = typeof window !== 'undefined' && localStorage.getItem(`hosted_${lobbyId}`) === 'true';
      const isHost = isHostStored && !data.host_payment_intent_id;
      const currentRole = isHost ? 'HOST' : 'PARTNER';

      setRole(currentRole);

      const hasUserPaidForRole = currentRole === 'HOST' ? !!data.host_payment_intent_id : !!data.partner_payment_intent_id;

      if (!hasUserPaidForRole && data.status !== 'MATCHED') {
        const res = await fetch('/api/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lobbyId,
            role: currentRole,
          }),
        });

        const intentData = await res.json();

        if (intentData.clientSecret) {
          setClientSecret(intentData.clientSecret);
        } else if (intentData.error) {
          console.error('Create PaymentIntent Server Error:', intentData.error);
          setFetchError(intentData.error);
        }
      }
    } catch (err: any) {
      console.error('Lobby Fetching Error:', err);
      setFetchError('Unexpected error loading lobby details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLobby();

    const channel = supabase
      .channel(`lobby_${lobbyId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'lobbies', filter: `id=eq.${lobbyId}` },
        (payload) => {
          const updated = payload.new as LobbyData;
          setLobby(updated);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-400 font-sans">
        <div className="flex items-center gap-3 bg-neutral-900 p-6 rounded-2xl shadow-sm border border-neutral-800">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="font-semibold text-sm">Loading BOGO Split Lobby...</span>
        </div>
      </div>
    );
  }

  if (fetchError || !lobby) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950 p-4 font-sans text-white">
        <div className="max-w-md bg-neutral-900 p-8 rounded-3xl shadow-md border border-neutral-800 text-center space-y-4">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-xl font-extrabold">Lobby Issue</h2>
          <p className="text-xs text-neutral-400">{fetchError || 'Unable to locate this lobby.'}</p>
        </div>
      </div>
    );
  }

  // MATH ENGINE
  const itemPrice = lobby.item_price || 0;
  const dealType = (lobby.deal_type || 'BOGO').toUpperCase();
  const isBogo50 = dealType === 'BOGO_50' || dealType === 'BUY_1_GET_1_50_OFF';

  const bogoPromoTotal = isBogo50 ? itemPrice * 1.5 : itemPrice;
  const baseShare = bogoPromoTotal / 2;
  const platformFee = (itemPrice * 0.05) / 2;

  const isHost = role === 'HOST';
  const hasHostPaid = !!lobby.host_payment_intent_id;
  const hasPartnerPaid = !!lobby.partner_payment_intent_id;
  const isMatched = lobby.status === 'MATCHED' && hasHostPaid && hasPartnerPaid;

  return (
    <div className="min-h-screen bg-neutral-950 text-white py-8 px-4 font-sans">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="bg-neutral-900 p-5 rounded-2xl border border-neutral-800 flex items-center justify-between">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-md">
              {isHost ? '👑 HOST DASHBOARD' : '🤝 PARTNER DEAL INVITATION'}
            </span>
            <h2 className="text-xl font-extrabold mt-2 text-white">{lobby.item_name}</h2>
          </div>
          <div className="text-right">
            <span className="text-xs text-neutral-500 block font-semibold">Deal Type</span>
            <span className="text-sm font-bold text-emerald-400">
              {isBogo50 ? 'Buy 1 Get 1 50% Off' : 'Buy 1 Get 1 Free'}
            </span>
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
          <div className="bg-neutral-900 p-6 rounded-3xl border border-neutral-800 space-y-4">
            <h3 className="text-base font-extrabold border-b border-neutral-800 pb-3 flex justify-between items-center text-white">
              <span>Price Breakdown (Per Person)</span>
            </h3>

            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-neutral-400">
                <span>BOGO Promo Total (Pre-tax)</span>
                <span className="font-semibold text-white">${bogoPromoTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Your Split Share (Pre-tax)</span>
                <span className="font-bold text-emerald-400">${baseShare.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Platform Fee (5% Retail Split)</span>
                <span className="font-semibold text-neutral-300">+${platformFee.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        {isHost && hasHostPaid && !isMatched && (
          <div className="bg-blue-500/10 border border-blue-500/20 p-6 rounded-3xl space-y-3">
            <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
              <span>🔗 Share Invite Link With a Partner</span>
            </div>
            <p className="text-xs text-blue-300">
              Your payment hold is placed! Share this link with a friend or social group to split the BOGO deal.
            </p>
            <button
              onClick={copyInviteLink}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-sm transition shadow-sm cursor-pointer"
            >
              {copied ? '✓ Invite Link Copied!' : 'Copy Invite Link'}
            </button>
          </div>
        )}

        {!isMatched && (
          <div className="bg-neutral-900 p-6 rounded-3xl border border-neutral-800 space-y-4">
            {(isHost && !hasHostPaid) || (!isHost && !hasPartnerPaid) ? (
              <>
                <h3 className="text-lg font-extrabold text-white border-b border-neutral-800 pb-3">
                  {isHost ? 'Authorize Host Payment Hold' : 'Join Deal & Authorize Your Split Share'}
                </h3>
                {clientSecret ? (
                  <Elements stripe={stripePromise} options={{ clientSecret }}>
                    <CheckoutForm
                      lobbyId={lobbyId}
                      role={role}
                      onSuccess={fetchLobby}
                    />
                  </Elements>
                ) : (
                  <div className="py-6 text-center text-xs font-semibold text-neutral-500">
                    Preparing secure Stripe checkout...
                  </div>
                )}
              </>
            ) : (
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-2xl text-xs font-semibold text-center space-y-1">
                <div>⏳ Waiting for {isHost ? 'Partner' : 'Host'} to authorize their share...</div>
                <div className="text-[11px] font-normal text-amber-400">
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
