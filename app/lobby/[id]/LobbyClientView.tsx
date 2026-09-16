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

const AVATAR_ROSTER = [
  { id: 'ninja', name: 'Deal Ninja', role: 'Female', icon: '🥷', quote: 'Slashing prices in silence' },
  { id: 'ranger', name: 'Loot Ranger', role: 'Female', icon: '🧝‍♀️', quote: 'Sniping 50% deals from afar' },
  { id: 'elder_f', name: 'Bargain Matriarch', role: 'Senior Female', icon: '👵', quote: 'Never pays full price' },
  { id: 'knight', name: 'Savings Knight', role: 'Male', icon: '⚔️', quote: 'Shielding your wallet' },
  { id: 'wizard', name: 'Discount Wizard', role: 'Male', icon: '🧙‍♂️', quote: 'Casting price cuts' },
  { id: 'elder_m', name: 'Coupon Elder', role: 'Senior Male', icon: '👴', quote: 'Back in my day, BOGO was free!' },
  { id: 'teen_skate', name: 'Skate Splitter', role: 'Teenager', icon: '🛹', quote: 'Flexing half-price drops' },
  { id: 'teen_gamer', name: 'Arcade Gamer', role: 'Teenager', icon: '🎮', quote: 'Chasing max loot high scores' },
];

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
  host_avatar?: string;
}

const CheckoutForm = memo(function CheckoutForm({
  lobbyId,
  role,
  basePrice,
  formData,
  isUpdating,
  avatarStage,
  selectedAvatar,
  onFormChange,
  onSuccess,
  onSubmittingStateChange,
}: {
  lobbyId: string;
  role: 'HOST' | 'PARTNER';
  basePrice: number;
  formData: AddressData;
  isUpdating: boolean;
  avatarStage: 'idle' | 'walking' | 'arrived';
  selectedAvatar: typeof AVATAR_ROSTER[0];
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
            className="w-full p-3 text-base border border-neutral-800 rounded-lg bg-neutral-950 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="w-full p-3 text-base border border-neutral-800 rounded-lg bg-neutral-950 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full p-3 text-base border border-neutral-800 rounded-lg bg-neutral-950 text-white"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-neutral-300 mb-1">State</label>
            <select
              value={formData.state}
              onChange={(e) => onFormChange('state', e.target.value)}
              className="w-full p-3 text-base border border-neutral-800 rounded-lg bg-neutral-950 text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Select State</option>
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
              inputMode="numeric"
              placeholder="ZIP Code"
              required
              value={formData.zip}
              onChange={(e) => onFormChange('zip', e.target.value)}
              className="w-full p-3 text-base border border-neutral-800 rounded-lg bg-neutral-950 text-white"
            />
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-neutral-300 mb-1">Phone</label>
          <input
            type="tel"
            inputMode="tel"
            placeholder="(555) 000-0000"
            required
            value={formData.phone}
            onChange={(e) => onFormChange('phone', e.target.value)}
            className="w-full p-3 text-base border border-neutral-800 rounded-lg bg-neutral-950 text-white"
          />
        </div>
      </div>

      <div className="bg-neutral-900/80 p-3.5 rounded-xl border border-neutral-800/80 text-xs space-y-2 relative">
        {isUpdating && (
          <div className="absolute inset-0 bg-neutral-950/70 backdrop-blur-[1px] rounded-xl flex items-center justify-center text-xs font-semibold text-emerald-400 z-10 animate-pulse">
            Updating Tax Hold...
          </div>
        )}
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
          <span>Estimated Sales Tax ({formData.state || 'N/A'}):</span>
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

      {/* AVATAR WALK DOWN ANIMATION (ENABLED FOR BOTH PLAYER 1 AND PLAYER 2) */}
      {avatarStage !== 'idle' && (
        <div className="flex flex-col items-center justify-center pt-2">
          <div
            className={`flex flex-col items-center justify-center ${
              avatarStage === 'walking' ? 'animate-walk-down' : 'animate-bounce'
            }`}
          >
            <div className="text-4xl mb-1 filter drop-shadow-[0_10px_10px_rgba(245,158,11,0.5)]">
              {selectedAvatar.icon}
            </div>
            <div className="bg-amber-400 text-black text-[11px] font-black px-3.5 py-2 rounded-xl shadow-xl border border-amber-300 flex items-center gap-1.5">
              <span>Click here when ready to save some money!</span>
              <span className="text-base">👇</span>
            </div>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || loading || isUpdating}
        className="w-full py-4 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:brightness-110 text-black font-black uppercase tracking-wider rounded-xl shadow-lg transition duration-200 text-base cursor-pointer transform active:scale-95 disabled:opacity-50"
      >
        {loading ? 'Securing Hold...' : `READY UP & LOCK IN $${totalAmountCharged.toFixed(2)}`}
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
  isUpdating,
  avatarStage,
  selectedAvatar,
  onFormChange,
  onSuccess,
  onSubmittingStateChange,
}: {
  lobbyId: string;
  role: 'HOST' | 'PARTNER';
  basePrice: number;
  clientSecret: string;
  formData: AddressData;
  isUpdating: boolean;
  avatarStage: 'idle' | 'walking' | 'arrived';
  selectedAvatar: typeof AVATAR_ROSTER[0];
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
        isUpdating={isUpdating}
        avatarStage={avatarStage}
        selectedAvatar={selectedAvatar}
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
  const [isUpdatingIntent, setIsUpdatingIntent] = useState<boolean>(false);
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_ROSTER[0]);
  const [waitingSeconds, setWaitingSeconds] = useState(0);

  const [avatarStage, setAvatarStage] = useState<'idle' | 'walking' | 'arrived'>('idle');

  const intentIdRef = useRef<string | null>(null);

  // ENSURED ZIP & STATE START COMPLETELY EMPTY FOR BOTH HOST AND PARTNER
  const [formData, setFormData] = useState<AddressData>({
    name: '',
    street1: '',
    city: '',
    state: '',
    zip: '', // Explicitly empty string for manual entry
    phone: '',
  });

  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(899);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const isSubmittingRef = useRef<boolean>(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
      setWaitingSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // TRIGGER AVATAR WALK SEQUENCE FOR BOTH PLAYER 1 AND PLAYER 2
  const triggerWalkSequence = (av: typeof AVATAR_ROSTER[0]) => {
    setSelectedAvatar(av);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`avatar_${lobbyId}`, av.id);
    }
    setAvatarStage('walking');
    setTimeout(() => {
      setAvatarStage('arrived');
    }, 1200);
  };

  const createOrUpdatePaymentIntent = async (currentRole: 'HOST' | 'PARTNER', state: string) => {
    setIsUpdatingIntent(true);
    try {
      const res = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lobbyId,
          role: currentRole,
          userState: state || 'NY',
          paymentIntentId: intentIdRef.current,
        }),
      });
      const intentData = await res.json();
      if (intentData.clientSecret) {
        setClientSecret(intentData.clientSecret);
        if (intentData.paymentIntentId) {
          intentIdRef.current = intentData.paymentIntentId;
        }
      } else if (intentData.error) {
        setFetchError(`Payment Intent Error: ${intentData.error}`);
      }
    } finally {
      setIsUpdatingIntent(false);
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

    if (typeof window !== 'undefined') {
      const savedAvatarId = localStorage.getItem(`avatar_${lobbyId}`);
      if (savedAvatarId) {
        const foundAv = AVATAR_ROSTER.find((a) => a.id === savedAvatarId);
        if (foundAv) setSelectedAvatar(foundAv);
      }
    }

    const hasUserPaid =
      currentRole === 'HOST' ? !!data.host_payment_intent_id : !!data.partner_payment_intent_id;

    if (!hasUserPaid && data.status !== 'MATCHED' && !clientSecret) {
      await createOrUpdatePaymentIntent(currentRole, formData.state);
    }
    setLoading(false);
  };

  const handleFormFieldChange = (field: keyof AddressData, value: string) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === 'state' && value !== prev.state && lobby && role) {
        createOrUpdatePaymentIntent(role, value);
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
    intentIdRef.current = null;
    await fetchLobbyState();
  };

  const handleCopyLink = async () => {
    if (typeof window === 'undefined') return;

    const shareData = {
      title: `BOGO Split Deal - ${lobby?.item_name || 'Item'}`,
      text: `Split this 50% off BOGO deal with me on ${lobby?.item_name || 'this item'}!`,
      url: window.location.href,
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        // User closed native share sheet
      }
    }

    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh] bg-black text-white">
        <p className="text-neutral-400 text-sm font-medium animate-pulse">Loading BOGO Lobby...</p>
      </div>
    );
  }

  if (fetchError || !lobby) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh] bg-black text-white">
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
      <div className="min-h-[100dvh] bg-black text-white flex items-center justify-center p-4">
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

  const getWaitingStage = () => {
    if (waitingSeconds < 15) {
      return {
        stage: 'warmup',
        badge: 'STATUS: WAITING FOR PLAYER 2',
        bubble: "Ready when you are! Let's get Player 2 in here!",
        subtext: "Thumb twiddling in progress...",
      };
    } else if (waitingSeconds < 30) {
      return {
        stage: 'sniffling',
        badge: 'STATUS: GETTING TEARY EYED 💧',
        bubble: "Is anyone coming? I really want this 50% discount...",
        subtext: "Sniffling dramatically on knees...",
      };
    } else {
      return {
        stage: 'begging',
        badge: 'STATUS: BEGGING ON KNEES 🙇',
        bubble: "PLEASE JOIN THE MATCH! HELP ME SAVE THIS LOOT PLEASE!",
        subtext: "Begging on knees holding a 'NEED PLAYER 2' sign!",
      };
    }
  };

  const currentStage = getWaitingStage();

  return (
    <div className="min-h-[100dvh] bg-black text-white p-4 flex flex-col items-center justify-center">
     
      {/* KEYFRAME ANIMATIONS */}
      <style jsx global>{`
        @keyframes walkDown {
          0% {
            transform: translateY(-240px) scale(1) rotate(0deg);
            opacity: 0.8;
          }
          25% {
            transform: translateY(-180px) scale(1.1) rotate(-8deg);
          }
          50% {
            transform: translateY(-120px) scale(1) rotate(8deg);
          }
          75% {
            transform: translateY(-60px) scale(1.1) rotate(-8deg);
          }
          100% {
            transform: translateY(0px) scale(1) rotate(0deg);
            opacity: 1;
          }
        }

        @keyframes mercyKneelBeg {
          0% {
            transform: translateY(0px) scale(1) rotate(0deg);
          }
          25% {
            transform: translateY(6px) scale(0.92) rotate(-6deg);
          }
          50% {
            transform: translateY(12px) scale(0.88) rotate(0deg);
          }
          75% {
            transform: translateY(6px) scale(0.92) rotate(6deg);
          }
          100% {
            transform: translateY(0px) scale(1) rotate(0deg);
          }
        }

        @keyframes tearFloat {
          0% {
            opacity: 1;
            transform: translateY(0px) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(20px) scale(1.4);
          }
        }

        .animate-walk-down {
          animation: walkDown 1.2s cubic-bezier(0.25, 1, 0.5, 1) forwards;
        }

        .animate-mercy-beg {
          animation: mercyKneelBeg 0.8s ease-in-out infinite;
        }

        .animate-tear-drop {
          animation: tearFloat 1s ease-out infinite;
        }
      `}</style>

      <div className="max-w-xl w-full bg-neutral-950 border border-neutral-800 shadow-2xl rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="flex justify-between items-center border-b border-neutral-800 pb-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              {role === 'HOST' ? 'Lobby Host (Player 1)' : 'Lobby Partner (Player 2)'}
            </span>
            <h1 className="text-xl font-black text-white mt-2">{lobby.item_name}</h1>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-neutral-400">Time Remaining</div>
            <div className="text-base font-mono font-bold text-amber-400">{formatTimer(timeLeft)}</div>
          </div>
        </div>

        {/* AVATAR SELECTOR BEFORE PAYING */}
        {!hasUserPaid && (
          <div className="bg-neutral-900/80 p-4 rounded-2xl border border-neutral-800 space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-xs font-black uppercase text-amber-400 tracking-wider">
                Choose Avatar ({role === 'HOST' ? 'Player 1' : 'Player 2'})
              </label>
              <span className="text-[10px] text-neutral-400 font-semibold">{selectedAvatar.role}</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {AVATAR_ROSTER.map((av) => (
                <button
                  key={av.id}
                  type="button"
                  onClick={() => triggerWalkSequence(av)}
                  className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                    selectedAvatar.id === av.id
                      ? 'border-amber-400 bg-amber-500/20 text-white scale-105 shadow-lg shadow-amber-500/10'
                      : 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  <div className="text-2xl mb-1">{av.icon}</div>
                  <div className="text-[10px] font-extrabold truncate">{av.name}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* CO-OP MATCHMAKING BOARD */}
        <div className="grid grid-cols-2 gap-3">
          {/* PLAYER 1 SLOT */}
          <div className="bg-neutral-900/90 border border-amber-500/30 p-4 rounded-2xl text-center space-y-2 relative">
            <div className="text-[10px] font-black uppercase tracking-wider text-amber-400">Player 1 (Host)</div>
            <div className="text-4xl my-1">{role === 'HOST' ? selectedAvatar.icon : '🥷'}</div>
            <div className="text-xs font-bold text-white">{role === 'HOST' ? selectedAvatar.name : 'Host Player'}</div>
            <div className="text-[10px] text-emerald-400 font-semibold">
              {lobby.host_payment_intent_id ? '✓ READY TO SPLIT' : 'SELECTING HOLD'}
            </div>
          </div>

          {/* PLAYER 2 SLOT */}
          <div className="bg-neutral-900/90 border border-neutral-800 p-4 rounded-2xl text-center space-y-2">
            <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Player 2 (Partner)</div>
            <div className="text-4xl my-1">{role === 'PARTNER' ? selectedAvatar.icon : '🤝'}</div>
            <div className="text-xs font-bold text-neutral-400">
              {role === 'PARTNER' ? selectedAvatar.name : 'Waiting for Partner...'}
            </div>
            <div className="text-[10px] text-amber-400 font-semibold animate-pulse">
              {lobby.partner_payment_intent_id ? '✓ READY' : 'SEARCHING...'}
            </div>
          </div>
        </div>

        {/* DRAMATIC MERCY-STYLE BEGGING LOBBY ANIMATION */}
        {role === 'HOST' && !lobby.partner_payment_intent_id && (
          <div className="bg-gradient-to-b from-neutral-900 via-neutral-950 to-black border border-amber-500/40 p-6 rounded-2xl text-center space-y-4 relative overflow-hidden shadow-xl">
            <span className="text-[9px] font-black uppercase tracking-widest text-black bg-amber-400 px-3 py-1 rounded-full shadow-md">
              {currentStage.badge}
            </span>

            <div className="relative py-2 flex flex-col items-center justify-center">
              {currentStage.stage !== 'warmup' && (
                <div className="absolute -top-1 flex gap-6 text-base animate-tear-drop">
                  <span>💧</span>
                  <span>💧</span>
                </div>
              )}

              <div
                className={`text-6xl filter drop-shadow-[0_10px_15px_rgba(245,158,11,0.4)] ${
                  currentStage.stage === 'warmup'
                    ? 'animate-pulse'
                    : 'animate-mercy-beg'
                }`}
              >
                {selectedAvatar.icon}
              </div>

              {currentStage.stage === 'begging' && (
                <div className="mt-1 bg-amber-200 text-black text-[9px] font-black px-2 py-0.5 rounded border border-amber-400 rotate-[-2deg] shadow-md">
                  🪧 NEED PLAYER 2 TO SAVE LOOT
                </div>
              )}
            </div>

            <div className="bg-neutral-900 border border-amber-400/50 text-amber-300 text-xs font-black p-3 rounded-2xl max-w-xs mx-auto shadow-inner relative">
              "{currentStage.bubble}"
            </div>

            <p className="text-[11px] text-neutral-400 font-medium">{currentStage.subtext}</p>

            <button
              onClick={handleCopyLink}
              className="w-full py-4 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:brightness-110 text-black font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer shadow-lg shadow-amber-500/10 transform active:scale-95"
            >
              {copied
                ? '✓ LOBBY LINK COPIED TO CLIPBOARD!'
                : '📢 SHARE CO-OP LOBBY LINK'}
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
            isUpdating={isUpdatingIntent}
            avatarStage={avatarStage}
            selectedAvatar={selectedAvatar}
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