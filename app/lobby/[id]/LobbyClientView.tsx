'use client';

import React, { useState, useEffect, useRef, memo } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { supabase } from '@/lib/supabase';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const STATE_TAX_RATES: Record<string, number> = {
  AK: 0.0181, AL: 0.0924, AR: 0.0944, AZ: 0.0837, CA: 0.0885, CO: 0.0778, CT: 0.0635,
  DC: 0.0600, DE: 0.0000, FL: 0.0700, GA: 0.0738, HI: 0.0444, IA: 0.0694, ID: 0.0603,
  IL: 0.0884, IN: 0.0700, KS: 0.0865, KY: 0.0600, LA: 0.0956, MA: 0.0625, MD: 0.0600,
  ME: 0.0550, MI: 0.0600, MN: 0.0803, MS: 0.0707, MO: 0.0833, MT: 0.0000, NC: 0.0698,
  ND: 0.0696, NE: 0.0697, NH: 0.0000, NJ: 0.0660, NM: 0.0772, NV: 0.0823, NY: 0.0853,
  OH: 0.0724, OK: 0.0899, OR: 0.0000, PA: 0.0634, RI: 0.0700, SC: 0.0744, SD: 0.0611,
  TN: 0.0955, TX: 0.0820, UT: 0.0722, VA: 0.0577, VT: 0.0636, WA: 0.0938, WI: 0.0543,
  WV: 0.0657, WY: 0.0536,
};

export interface AddressData {
  name: string;
  street1: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  taxRate?: number;
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
  issuing_card_id?: string;
  virtual_card_last4?: string;
  user_a_address?: AddressData;
  user_b_address?: AddressData;
}

const CheckoutForm = memo(function CheckoutForm({
  lobbyId,
  role,
  basePrice,
  formData,
  onFormChange,
  onSuccess,
  onSubmittingStateChange,
}: {
  lobbyId: string;
  role: 'HOST' | 'PARTNER';
  basePrice: number;
  formData: AddressData;
  onFormChange: (field: keyof AddressData, value: string) => void;
  onSuccess: () => void;
  onSubmittingStateChange: (isSubmitting: boolean) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const splitShare = basePrice / 2;
  const platformFee = Math.round(splitShare * 0.025 * 100) / 100;
  const taxRate = STATE_TAX_RATES[formData.state] ?? 0.0853;
  const calculatedTax = Math.round(splitShare * taxRate * 100) / 100;
  const stripeFee = Math.round((splitShare * 0.029 + 0.30) * 100) / 100;
 
  const totalAmountCharged = splitShare + calculatedTax + platformFee + stripeFee;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      setErrorMessage('Stripe SDK has not fully initialized.');
      return;
    }

    setLoading(true);
    onSubmittingStateChange(true);
    setErrorMessage('');

    try {
      const currentOrigin =
        typeof window !== 'undefined'
          ? window.location.origin
          : 'https://bogo-prototype-wheat.vercel.app';
      const redirectUrl = `${currentOrigin}/lobby/${lobbyId}`;

      const result = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: redirectUrl },
        redirect: 'if_required',
      });

      if (result.error) {
        setErrorMessage(result.error.message || 'Unknown Stripe Error');
        return;
      }

      const paymentIntent = result.paymentIntent;

      if (paymentIntent && (paymentIntent.status === 'requires_capture' || paymentIntent.status === 'succeeded')) {
        const isHost = role === 'HOST';
        const addressData: AddressData = {
          name: formData.name,
          street1: formData.street1,
          city: formData.city,
          state: formData.state,
          zip: formData.zip,
          phone: formData.phone,
          taxRate,
        };

        const updateData = isHost
          ? { host_payment_intent_id: paymentIntent.id, user_a_address: addressData }
          : { partner_payment_intent_id: paymentIntent.id, user_b_address: addressData };

        const { error: dbErr } = await supabase.from('lobbies').update(updateData).eq('id', lobbyId);

        if (dbErr) throw new Error('Database sync failed: ' + dbErr.message);

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

        await onSuccess();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected client-side error occurred');
    } finally {
      setLoading(false);
      onSubmittingStateChange(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-left">
      <div className="bg-neutral-900 p-4 rounded-2xl border border-neutral-800 space-y-3">
        <h4 className="text-xs font-bold uppercase text-neutral-400 tracking-wider">
          Shipping & Billing Information
        </h4>
        <div>
          <label className="block text-[11px] font-semibold text-neutral-300 mb-1">Full Name</label>
          <input
            type="text"
            placeholder="Jane Doe"
            required
            value={formData.name}
            onChange={(e) => onFormChange('name', e.target.value)}
            className="w-full p-2.5 text-sm border border-neutral-800 rounded-lg bg-neutral-950 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-neutral-300 mb-1">Street Address</label>
          <input
            type="text"
            placeholder="123 Main St, Apt 4B"
            required
            value={formData.street1}
            onChange={(e) => onFormChange('street1', e.target.value)}
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
              value={formData.city}
              onChange={(e) => onFormChange('city', e.target.value)}
              className="w-full p-2.5 text-sm border border-neutral-800 rounded-lg bg-neutral-950 text-white"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-neutral-300 mb-1">State</label>
            <select
              value={formData.state}
              onChange={(e) => onFormChange('state', e.target.value)}
              className="w-full p-2.5 text-sm border border-neutral-800 rounded-lg bg-neutral-950 text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {Object.keys(STATE_TAX_RATES).sort().map((st) => (
                <option key={st} value={st}>
                  {st} ({(STATE_TAX_RATES[st] * 100).toFixed(2)}%)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-neutral-300 mb-1">ZIP</label>
            <input
              type="text"
              placeholder="10001"
              required
              value={formData.zip}
              onChange={(e) => onFormChange('zip', e.target.value)}
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
            value={formData.phone}
            onChange={(e) => onFormChange('phone', e.target.value)}
            className="w-full p-2.5 text-sm border border-neutral-800 rounded-lg bg-neutral-950 text-white"
          />
        </div>
      </div>

      <div className="bg-neutral-900/80 p-3.5 rounded-xl border border-neutral-800/80 text-xs space-y-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-800 pb-1.5">
          Hold Breakdown
        </div>
        <div className="flex justify-between text-neutral-300">
          <span>{role === 'HOST' ? 'Host' : 'Partner'} Base Share (50% Off):</span>
          <span className="font-mono text-white">${splitShare.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-neutral-400">
          <span>Platform Fee (2.5% Retail Split):</span>
          <span className="font-mono text-neutral-300">+${platformFee.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-neutral-400">
          <span>Estimated Sales Tax ({formData.state}):</span>
          <span className="font-mono text-neutral-300">+${calculatedTax.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-neutral-400">
          <span>Stripe Processing Fee:</span>
          <span className="font-mono text-neutral-300">+${stripeFee.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-emerald-400 font-bold border-t border-neutral-800 pt-2 text-sm">
          <span>Total Authorized Hold:</span>
          <span className="font-mono">${totalAmountCharged.toFixed(2)}</span>
        </div>
      </div>

      <div className="bg-neutral-900 p-4 rounded-2xl border border-neutral-800">
        <h4 className="text-xs font-bold uppercase text-neutral-400 tracking-wider mb-3">
          Payment Pre-Authorization
        </h4>
        <PaymentElement />
      </div>

      {errorMessage && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-xl font-semibold">
          {errorMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold rounded-xl shadow-lg transition duration-200 text-base cursor-pointer transform active:scale-95 disabled:opacity-50"
      >
        {loading ? 'Securing Hold...' : `Authorize $${totalAmountCharged.toFixed(2)} Hold`}
      </button>
    </form>
  );
});

const StripeCheckoutWrapper = memo(function StripeCheckoutWrapper({
  lobbyId,
  role,
  basePrice,
  clientSecret,
  formData,
  onFormChange,
  onSuccess,
  onSubmittingStateChange,
}: {
  lobbyId: string;
  role: 'HOST' | 'PARTNER';
  basePrice: number;
  clientSecret: string;
  formData: AddressData;
  onFormChange: (field: keyof AddressData, value: string) => void;
  onSuccess: () => Promise<void>;
  onSubmittingStateChange: (isSubmitting: boolean) => void;
}) {
  return (
    <Elements key={clientSecret} stripe={stripePromise} options={{ clientSecret }}>
      <CheckoutForm
        lobbyId={lobbyId}
        role={role}
        basePrice={basePrice}
        formData={formData}
        onFormChange={onFormChange}
        onSuccess={onSuccess}
        onSubmittingStateChange={onSubmittingStateChange}
      />
    </Elements>
  );
});

export default function LobbyClientView({ lobbyId }: { lobbyId: string }) {
  const [lobby, setLobby] = useState<LobbyData | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [role, setRole] = useState<'HOST' | 'PARTNER'>('PARTNER');
 
  // Lift shipping form inputs to parent component state so re-fetching PaymentIntent never clears them
  const [formData, setFormData] = useState<AddressData>({
    name: '',
    street1: '',
    city: '',
    state: 'NY',
    zip: '',
    phone: '',
  });

  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(899);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const isSubmittingRef = useRef<boolean>(false);

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const createPaymentIntent = async (currentRole: 'HOST' | 'PARTNER', state: string) => {
    const res = await fetch('/api/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lobbyId, role: currentRole, userState: state }),
    });
    const intentData = await res.json();
    if (intentData.clientSecret) {
      setClientSecret(intentData.clientSecret);
    } else if (intentData.error) {
      setFetchError(`Payment Intent Error: ${intentData.error}`);
    }
  };

  const fetchLobbyState = async () => {
    const { data, error } = await supabase.from('lobbies').select('*').eq('id', lobbyId).single();
    if (error || !data) {
      setFetchError('Lobby not found in database.');
      setLoading(false);
      return;
    }

    setLobby(data);

    const isHostStored =
      typeof window !== 'undefined' && localStorage.getItem(`hosted_${lobbyId}`) === 'true';
    const isHost = isHostStored || !data.host_payment_intent_id;
    const currentRole = isHost ? 'HOST' : 'PARTNER';
    setRole(currentRole);

    const hasUserPaid =
      currentRole === 'HOST' ? !!data.host_payment_intent_id : !!data.partner_payment_intent_id;

    if (!hasUserPaid && data.status !== 'MATCHED') {
      await createPaymentIntent(currentRole, formData.state);
    }
    setLoading(false);
  };

  const handleFormFieldChange = async (field: keyof AddressData, value: string) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === 'state' && value !== prev.state && lobby && role) {
        setClientSecret(null);
        createPaymentIntent(role, value);
      }
      return updated;
    });
  };

  useEffect(() => {
    fetchLobbyState();

    const channel = supabase
      .channel(`realtime-lobby-${lobbyId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'lobbies',
          filter: `id=eq.${lobbyId}`,
        },
        (payload) => {
          setLobby(payload.new as LobbyData);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [lobbyId]);

  const handlePaymentSuccess = async () => {
    setClientSecret(null);
    await fetchLobbyState();
  };

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white">
        <p className="text-neutral-400 text-sm font-medium animate-pulse">Loading BOGO Lobby...</p>
      </div>
    );
  }

  if (fetchError || !lobby) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white">
        <p className="text-rose-400 font-semibold">{fetchError || 'Lobby not found.'}</p>
      </div>
    );
  }

  if (lobby.status === 'MATCHED') {
    const originalPrice = Number(lobby.item_price) || 0;
    const splitBase = originalPrice / 2;
    const platformFee = Math.round(splitBase * 0.025 * 100) / 100;

    const userAddress = role === 'HOST' ? lobby.user_a_address : lobby.user_b_address;
    const userState = userAddress?.state || formData.state;
    const stateTaxRate = STATE_TAX_RATES[userState] ?? 0.0853;
    const calculatedTax = Math.round(splitBase * stateTaxRate * 100) / 100;
    const stripeFee = Math.round((splitBase * 0.029 + 0.30) * 100) / 100;

    const totalPaidWithTax = splitBase + calculatedTax + platformFee + stripeFee;
    const totalSaved = originalPrice - splitBase;

    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-neutral-950 border border-emerald-500/30 shadow-2xl rounded-3xl p-6 sm:p-8 text-center space-y-6">
          <div className="space-y-3">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mx-auto text-3xl font-extrabold shadow-lg shadow-emerald-500/10">
              ✓
            </div>
            <div>
              <span className="inline-block text-[11px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 mb-2">
                You Saved ${totalSaved.toFixed(2)}
              </span>
              <h2 className="text-2xl font-black text-white tracking-tight">BOGO Match Confirmed!</h2>
              <p className="text-xs text-neutral-400 mt-1">
                Your payment hold was captured and virtual card issued.
              </p>
            </div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 text-left flex justify-between items-center">
            <div>
              <div className="text-[10px] uppercase font-extrabold text-neutral-400 tracking-wider">Item Purchased</div>
              <div className="text-sm font-bold text-white mt-0.5">{lobby.item_name}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase font-bold text-neutral-500">Retail Price</div>
              <div className="text-xs font-semibold text-neutral-400 line-through">${originalPrice.toFixed(2)}</div>
            </div>
          </div>

          <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-2xl p-4 text-left space-y-2.5 text-xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-800 pb-2">
              Payment Receipt Breakdown
            </div>

            <div className="flex justify-between text-neutral-300">
              <span className="text-neutral-400">Original Item Retail Price:</span>
              <span className="font-mono text-neutral-300 line-through">${originalPrice.toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-neutral-300">
              <span className="text-neutral-400">Your Split Share (50% Off):</span>
              <span className="font-mono text-emerald-400 font-semibold">${splitBase.toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-neutral-300">
              <span className="text-neutral-400">Platform Fee (2.5% Retail Split):</span>
              <span className="font-mono text-neutral-300">+${platformFee.toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-neutral-300">
              <span className="text-neutral-400">Sales Tax ({userState}):</span>
              <span className="font-mono text-neutral-300">+${calculatedTax.toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-neutral-300">
              <span className="text-neutral-400">Stripe Processing Fee:</span>
              <span className="font-mono text-neutral-300">+${stripeFee.toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-white border-t border-neutral-800 pt-2.5 font-bold text-sm">
              <span className="text-white">Total Amount Charged:</span>
              <span className="font-mono text-emerald-400">${totalPaidWithTax.toFixed(2)}</span>
            </div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-left space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-neutral-300">Virtual Issuing Card</span>
              <span className="font-mono text-[11px] bg-neutral-800 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/20">
                •••• {lobby.virtual_card_last4 || '4242'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-medium">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shrink-0"></span>
              <span>Order queued for fulfillment with virtual card #{lobby.issuing_card_id || 'ic_active'}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const hasUserPaid =
    role === 'HOST' ? !!lobby.host_payment_intent_id : !!lobby.partner_payment_intent_id;

  return (
    <div className="min-h-screen bg-black text-white p-4 flex flex-col items-center justify-center">
      <div className="max-w-xl w-full bg-neutral-950 border border-neutral-800 shadow-2xl rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="flex justify-between items-center border-b border-neutral-800 pb-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              {role === 'HOST' ? 'Lobby Host' : 'Lobby Partner'}
            </span>
            <h1 className="text-xl font-black text-white mt-2">{lobby.item_name}</h1>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-neutral-400">Time Remaining</div>
            <div className="text-base font-mono font-bold text-amber-400">{formatTimer(timeLeft)}</div>
          </div>
        </div>

        {role === 'HOST' && !lobby.partner_payment_intent_id && (
          <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-2xl flex items-center justify-between gap-3">
            <div className="text-xs text-neutral-300">
              <span className="font-bold text-white block mb-0.5">Invite a Partner</span>
              Share this link to split the purchase 50/50.
            </div>
            <button
              onClick={handleCopyLink}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs rounded-xl transition cursor-pointer shrink-0"
            >
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
          </div>
        )}

        {!hasUserPaid && clientSecret ? (
          <StripeCheckoutWrapper
            lobbyId={lobbyId}
            role={role}
            basePrice={lobby.item_price}
            clientSecret={clientSecret}
            formData={formData}
            onFormChange={handleFormFieldChange}
            onSuccess={handlePaymentSuccess}
            onSubmittingStateChange={(submitting) => {
              isSubmittingRef.current = submitting;
            }}
          />
        ) : hasUserPaid ? (
          <div className="p-6 bg-neutral-900 border border-neutral-800 rounded-2xl text-center space-y-3">
            <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
              ✓
            </div>
            <h3 className="text-base font-bold text-white">Payment Hold Authorized!</h3>
            <p className="text-xs text-neutral-400">
              Awaiting partner authorization to capture funds and issue virtual card...
            </p>
          </div>
        ) : (
          <div className="p-6 bg-neutral-900 border border-neutral-800 rounded-2xl text-center">
            <p className="text-xs text-neutral-400 animate-pulse">Initializing Stripe Checkout...</p>
          </div>
        )}
      </div>
    </div>
  );
}

