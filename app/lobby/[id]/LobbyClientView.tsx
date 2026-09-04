'use client';

import React, { useState, useEffect, useRef } from 'react';
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
}

// -------------------------------------------------------------
// ISOLATED CHECKOUT FORM (Prevents re-renders from mutating Intent)
// -------------------------------------------------------------
function CheckoutForm({ lobbyId, role, onSuccess }: { lobbyId: string; role: 'HOST' | 'PARTNER'; onSuccess: () => void }) {
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
  const [rawErrorDetails, setRawErrorDetails] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      setErrorMessage('Stripe SDK has not fully initialized.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setRawErrorDetails('');

    try {
      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://bogo-prototype-wheat.vercel.app';
      const redirectUrl = `${currentOrigin}/lobby/${lobbyId}`;

      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: redirectUrl,
        },
        redirect: 'if_required',
      });

      if (result.error) {
        console.error('FULL STRIPE CONFIRMATION ERROR OBJECT:', result.error);

        const detailedMessage = result.error.message || 'Unknown Stripe Error';
        const code = result.error.code ? `[Code: ${result.error.code}]` : '';
        const declineCode = result.error.decline_code ? `[Decline Code: ${result.error.decline_code}]` : '';
        const param = result.error.param ? `[Param: ${result.error.param}]` : '';
        const type = result.error.type ? `[Type: ${result.error.type}]` : '';

        setErrorMessage(detailedMessage);
        setRawErrorDetails(`${type} ${code} ${declineCode} ${param}`.trim());
        setLoading(false);
        return;
      }

      const paymentIntent = result.paymentIntent;

      if (paymentIntent && (paymentIntent.status === 'requires_capture' || paymentIntent.status === 'succeeded')) {
        const isHost = role === 'HOST';
        const addressData: AddressData = { name, street1: street, city, state, zip, phone };

        const updateData = isHost
          ? { host_payment_intent_id: paymentIntent.id, user_a_address: addressData }
          : { partner_payment_intent_id: paymentIntent.id, user_b_address: addressData };

        const { error: dbErr } = await supabase.from('lobbies').update(updateData).eq('id', lobbyId);

        if (dbErr) {
          throw new Error('Database sync failed: ' + dbErr.message);
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

          if (!confirmRes.ok) {
            const confirmData = await confirmRes.json();
            throw new Error(confirmData.error || 'Failed capturing dual payment holds');
          }
        }

        onSuccess();
      } else {
        setErrorMessage(`Payment intent in unexpected state: ${paymentIntent?.status}`);
      }
    } catch (err: any) {
      console.error('Checkout Submission Catch Error:', err);
      setErrorMessage(err.message || 'An unexpected client-side error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-neutral-900 p-4 rounded-2xl border border-neutral-800 space-y-3">
        <h4 className="text-xs font-bold uppercase text-neutral-400 tracking-wider">
          📦 Shipping & Billing Information
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
              className="w-full p-2.5 text-sm border border-neutral-800 rounded-lg bg-neutral-950 text-white"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-neutral-300 mb-1">State</label>
            <input
              type="text"
              placeholder="NY"
              required
              value={state}
              onChange={(e) => setState(e.target.value.toUpperCase())}
              className="w-full p-2.5 text-sm border border-neutral-800 rounded-lg bg-neutral-950 text-white uppercase"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-neutral-300 mb-1">ZIP</label>
            <input
              type="text"
              placeholder="10001"
              required
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              className="w-full p-2.5 text-sm border border-neutral-800 rounded-lg bg-neutral-950 text-white"
            />
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-neutral-300 mb-1">Phone</label>
          <input
            type="tel"
            placeholder="(555) 000-0000"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full p-2.5 text-sm border border-neutral-800 rounded-lg bg-neutral-950 text-white"
          />
        </div>
      </div>

      <div className="bg-neutral-900 p-4 rounded-2xl border border-neutral-800">
        <h4 className="text-xs font-bold uppercase text-neutral-400 tracking-wider mb-3">
          💳 Payment Pre-Authorization
        </h4>
        <PaymentElement />
      </div>

      {errorMessage && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-xl font-semibold space-y-1">
          <div className="font-bold text-sm">⚠️ {errorMessage}</div>
          {rawErrorDetails && (
            <div className="text-[11px] text-rose-300/80 font-mono bg-black/40 p-2 rounded border border-rose-500/20 break-all">
              Diagnostics: {rawErrorDetails}
            </div>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold rounded-xl shadow-lg transition duration-200 text-base cursor-pointer transform active:scale-95 disabled:opacity-50"
      >
        {loading ? '⚡ Securing Hold...' : `🚀 Authorize & Claim ${role === 'HOST' ? 'Host' : 'Partner'} Share`}
      </button>
    </form>
  );
}

// -------------------------------------------------------------
// STABLE STRIPE ELEMENTS WRAPPER (Prevents re-instantiating Elements)
// -------------------------------------------------------------
function StripeCheckoutWrapper({ lobbyId, role, clientSecret, onSuccess }: { lobbyId: string; role: 'HOST' | 'PARTNER'; clientSecret: string; onSuccess: () => void }) {
  const optionsRef = useRef({ clientSecret });

  return (
    <Elements stripe={stripePromise} options={optionsRef.current}>
      <CheckoutForm lobbyId={lobbyId} role={role} onSuccess={onSuccess} />
    </Elements>
  );
}

export default function LobbyClientView({ lobbyId }: { lobbyId: string }) {
  const [lobby, setLobby] = useState<LobbyData | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [role, setRole] = useState<'HOST' | 'PARTNER'>('PARTNER');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(899);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const intentCreatedRef = useRef<boolean>(false);

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const initLobbyAndIntent = async () => {
    try {
      const { data, error } = await supabase.from('lobbies').select('*').eq('id', lobbyId).single();
      if (error || !data) {
        setFetchError('Lobby not found in database.');
        setLoading(false);
        return;
      }

      setLobby(data);

      const isHostStored = typeof window !== 'undefined' && localStorage.getItem(`hosted_${lobbyId}`) === 'true';
      const isHost = isHostStored && !data.host_payment_intent_id;
      const currentRole = isHost ? 'HOST' : 'PARTNER';
      setRole(currentRole);

      const hasUserPaid = currentRole === 'HOST' ? !!data.host_payment_intent_id : !!data.partner_payment_intent_id;

      if (!hasUserPaid && data.status !== 'MATCHED' && !intentCreatedRef.current) {
        intentCreatedRef.current = true;
        const res = await fetch('/api/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lobbyId, role: currentRole }),
        });
        const intentData = await res.json();
        if (intentData.clientSecret) {
          setClientSecret(intentData.clientSecret);
        } else if (intentData.error) {
          setFetchError(`Payment Intent Error: ${intentData.error}`);
        }
      }
    } catch (err: any) {
      console.error('Fetch Lobby Catch Error:', err);
      setFetchError(err.message || 'Error fetching lobby data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initLobbyAndIntent();

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
      <div className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-400 font-sans">
        <div className="flex items-center gap-3 bg-neutral-900 p-6 rounded-2xl border border-neutral-800">
          <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <span className="font-bold text-sm">Initializing Gamified Lobby...</span>
        </div>
      </div>
    );
  }

  const itemPrice = lobby.item_price || 0;
  const isBogo50 = lobby.deal_type === 'BOGO_50';
  const bogoPromoTotal = isBogo50 ? itemPrice * 1.5 : itemPrice;
  const baseShare = bogoPromoTotal / 2;
  const platformFee = (itemPrice * 0.05) / 2;
  const personalSavings = itemPrice - baseShare;

  const isHost = role === 'HOST';
  const hasHostPaid = !!lobby.host_payment_intent_id;
  const hasPartnerPaid = !!lobby.partner_payment_intent_id;
  const isMatched = lobby.status === 'MATCHED' && hasHostPaid && hasPartnerPaid;

  const progressPercent = isMatched ? 100 : hasHostPaid || hasPartnerPaid ? 50 : 10;

  return (
    <div className="min-h-screen bg-neutral-950 text-white py-8 px-4 font-sans">
      <div className="max-w-xl mx-auto space-y-6">

        {/* Gamified Banner */}
        <div className="bg-gradient-to-r from-blue-900/40 via-purple-900/40 to-neutral-900 p-5 rounded-3xl border border-neutral-800 space-y-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🏆</span>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  +250 BOGO XP AVAILABLE
                </span>
                <h2 className="text-lg font-black text-white mt-1">{lobby.item_name}</h2>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-amber-400 font-extrabold flex items-center gap-1 justify-end">
                <span>⏱️ Hold Expires:</span>
              </span>
              <span className="text-base font-black text-white">{formatTimer(timeLeft)}</span>
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-neutral-800">
            <div className="flex justify-between text-xs font-bold text-neutral-300">
              <span>Deal Match Unlock Progress</span>
              <span className="text-emerald-400">{progressPercent}% Unlocked</span>
            </div>
            <div className="w-full h-3 bg-neutral-950 rounded-full overflow-hidden border border-neutral-800">
              <div
                className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 transition-all duration-700 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {fetchError && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl font-bold">
            ⚠️ {fetchError}
          </div>
        )}

        {/* Match Celebration */}
        {isMatched ? (
          <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-8 rounded-3xl shadow-2xl space-y-3 text-center border border-emerald-400/30">
            <div className="text-5xl animate-bounce">🎉</div>
            <h3 className="text-2xl font-black tracking-tight">DEAL MATCH UNLOCKED!</h3>
            <p className="text-xs text-emerald-100 font-medium">
              You both saved <span className="font-bold text-white">${personalSavings.toFixed(2)}</span>! Pre-authorizations have been captured and order processing has begun.
            </p>
            <div className="inline-block bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20 text-xs font-bold text-emerald-200 mt-2">
              🏅 Badge Unlocked: Master Deal Matcher
            </div>
          </div>
        ) : (
          <div className="bg-neutral-900 p-6 rounded-3xl border border-neutral-800 space-y-4">
            <h3 className="text-base font-extrabold border-b border-neutral-800 pb-3 flex justify-between items-center text-white">
              <span>Price Breakdown</span>
              <span className="text-xs font-extrabold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                Saves ${personalSavings.toFixed(2)} Each
              </span>
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
              <span>🤝 Challenge a Friend to Split & Earn +250 XP</span>
            </div>
            <p className="text-xs text-blue-300">
              Your share is locked in! Send this invite link to a partner before the 15-minute timer expires.
            </p>
            <button
              onClick={copyInviteLink}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl text-sm transition shadow-md cursor-pointer"
            >
              {copied ? '✓ Invite Link Copied to Clipboard!' : '🔗 Copy Share Invite Link'}
            </button>
          </div>
        )}

        {!isMatched && (
          <div className="bg-neutral-900 p-6 rounded-3xl border border-neutral-800 space-y-4">
            {(isHost && !hasHostPaid) || (!isHost && !hasPartnerPaid) ? (
              <>
                <h3 className="text-lg font-extrabold text-white border-b border-neutral-800 pb-3">
                  {isHost ? 'Authorize Host Pre-Hold' : 'Accept Challenge & Claim Partner Split'}
                </h3>
                {clientSecret ? (
                  <StripeCheckoutWrapper
                    lobbyId={lobbyId}
                    role={role}
                    clientSecret={clientSecret}
                    onSuccess={initLobbyAndIntent}
                  />
                ) : (
                  <div className="py-6 text-center text-xs font-semibold text-neutral-500">
                    Preparing Stripe Checkout...
                  </div>
                )}
              </>
            ) : (
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-2xl text-xs font-semibold text-center space-y-1">
                <div>⏳ Waiting for {isHost ? 'Partner' : 'Host'} to authorize their split...</div>
                <div className="text-[11px] font-normal text-amber-400">
                  Neither card is charged until both players lock in their hold.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
