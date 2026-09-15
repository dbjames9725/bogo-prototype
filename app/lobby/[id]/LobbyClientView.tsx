'use client';

import React, { useState, useEffect, useRef, memo } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { toast } from 'sonner';
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
  { id: 'ranger', name: 'Loot Ranger', role: 'Female', icon: '🏹', quote: 'Sniping 50% deals from afar' },
  { id: 'elder_f', name: 'Bargain Matriarch', role: 'Senior Female', icon: '👵', quote: 'Never pays full price' },
  { id: 'knight', name: 'Savings Knight', role: 'Male', icon: '🛡️', quote: 'Shielding your wallet' },
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
  partner_avatar?: string;
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

        toast.success('⚡ Pre-authorization hold secured successfully!');

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
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : 'An unexpected client-side error occurred';
      setErrorMessage(errMessage);
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

      {/* AVATAR WALK DOWN ANIMATION */}
      {avatarStage !== 'idle' && (
        <div className="flex flex-col items-center justify-center pt-2">
          <div
            className={`flex flex-col items-center justify-center ${
              avatarStage === 'walking' ? 'animate-bounce' : 'animate-pulse'
            }`}
          >
            <div className="text-4xl mb-1 filter drop-shadow-[0_10px_10px_rgba(245,158,11,0.5)]">
              {selectedAvatar.icon}
            </div>
            <div className="text-xs font-bold text-amber-400">{selectedAvatar.name}</div>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !stripe}
        className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 disabled:bg-neutral-800 text-neutral-950 font-extrabold text-base rounded-xl transition shadow-lg shadow-emerald-500/20"
      >
        {loading ? 'Securing Hold Authorization...' : `Pre-Authorize $${totalAmountCharged.toFixed(2)}`}
      </button>
    </form>
  );
});

export default function LobbyClientView({ lobbyId }: { lobbyId: string }) {
  const [lobby, setLobby] = useState<LobbyData | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [role, setRole] = useState<'HOST' | 'PARTNER'>('PARTNER');
  const [avatarStage, setAvatarStage] = useState<'idle' | 'walking' | 'arrived'>('idle');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_ROSTER[0]);
  const [isUpdating, setIsUpdating] = useState(false);

  const [formData, setFormData] = useState<AddressData>({
    name: '',
    street1: '',
    city: '',
    state: 'NY',
    zip: '',
    phone: '',
  });

  const handleFormChange = (field: keyof AddressData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    const isHost = typeof window !== 'undefined' && localStorage.getItem(`hosted_${lobbyId}`) === 'true';
    setRole(isHost ? 'HOST' : 'PARTNER');

    const loadLobby = async () => {
      const { data, error } = await supabase.from('lobbies').select('*').eq('id', lobbyId).single();
      if (error || !data) {
        toast.error('Could not load lobby data.');
        return;
      }
      setLobby(data);

      const res = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lobbyId,
          role: isHost ? 'HOST' : 'PARTNER',
          amount: Math.round((Number(data.item_price) / 2) * 100),
        }),
      });

      const intentData = await res.json();
      if (intentData.clientSecret) {
        setClientSecret(intentData.clientSecret);
      }
    };

    loadLobby();

    // Subscribe to Real-Time Updates & Fire Sonner Toasts
    const channel = supabase
      .channel(`lobby-realtime-${lobbyId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'lobbies',
          filter: `id=eq.${lobbyId}`,
        },
        (payload) => {
          const updatedLobby = payload.new as LobbyData;

          setLobby((prevLobby) => {
            if (prevLobby) {
              if (!prevLobby.partner_payment_intent_id && updatedLobby.partner_payment_intent_id) {
                toast.success('🎉 Player 2 joined! Authorizing shared payment holds...', { duration: 5000 });
              }

              if (prevLobby.status !== 'MATCHED' && updatedLobby.status === 'MATCHED') {
                toast.success('⚡ Co-Op Match Confirmed! Virtual card generated.', { duration: 6000 });
              }

              if (prevLobby.status !== 'EXPIRED' && updatedLobby.status === 'EXPIRED') {
                toast.error('⏰ Lobby time limit expired. Payment holds released.', { duration: 5000 });
              }
            }
            return updatedLobby;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [lobbyId]);

  if (!lobby) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-6 text-center">
      {/* AVATAR SELECTION ROSTER BAR */}
      <div className="mb-6 bg-neutral-900 border border-neutral-800 p-4 rounded-2xl">
        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">
          Choose Your Deal Avatar
        </h3>
        <div className="grid grid-cols-4 gap-2">
          {AVATAR_ROSTER.map((av) => (
            <button
              key={av.id}
              type="button"
              onClick={() => {
                setSelectedAvatar(av);
                setAvatarStage('walking');
                setTimeout(() => setAvatarStage('arrived'), 1200);
              }}
              className={`p-2 rounded-xl border text-center transition ${
                selectedAvatar.id === av.id
                  ? 'border-emerald-500 bg-emerald-500/10 text-white'
                  : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:border-neutral-700'
              }`}
            >
              <div className="text-2xl">{av.icon}</div>
              <div className="text-[10px] font-bold truncate mt-1">{av.name}</div>
            </button>
          ))}
        </div>
      </div>

      {/* LOBBY HEADER CARD */}
      <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl shadow-2xl mb-6">
        <span className="inline-block px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-full mb-3 border border-emerald-500/20">
          50/50 Co-Op Split Active
        </span>
        <h1 className="text-3xl font-black text-white mb-1">{lobby.item_name}</h1>
        <p className="text-neutral-400 text-sm mb-4">Lobby #{lobbyId.slice(0, 8)}</p>

        <div className="grid grid-cols-2 gap-3 bg-neutral-950 p-4 rounded-2xl border border-neutral-800/80 mb-6">
          <div>
            <div className="text-xs text-neutral-500 font-semibold uppercase">Retail Price</div>
            <div className="text-xl font-bold text-neutral-400 line-through">
              ${Number(lobby.item_price).toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-xs text-emerald-400 font-semibold uppercase">Your 50% Split</div>
            <div className="text-2xl font-black text-emerald-400">
              ${(Number(lobby.item_price) / 2).toFixed(2)}
            </div>
          </div>
        </div>

        {lobby.status === 'MATCHED' ? (
          <div className="p-5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-300">
            <h3 className="text-lg font-extrabold mb-1">🎉 Virtual Card Activated!</h3>
            <p className="text-xs text-emerald-400/90">
              Card ending in <strong className="text-white font-mono">{lobby.virtual_card_last4 || '4242'}</strong> is now funded and ready for merchant checkout.
            </p>
          </div>
        ) : clientSecret ? (
          <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night' } }}>
            <CheckoutForm
              lobbyId={lobbyId}
              role={role}
              basePrice={Number(lobby.item_price)}
              formData={formData}
              isUpdating={isUpdating}
              avatarStage={avatarStage}
              selectedAvatar={selectedAvatar}
              onFormChange={handleFormChange}
              onSuccess={() => setLobby((prev) => prev ? { ...prev, status: 'MATCHED' } : prev)}
              onSubmittingStateChange={setIsUpdating}
            />
          </Elements>
        ) : (
          <div className="text-xs text-neutral-400 animate-pulse">Initializing Stripe Secure Elements...</div>
        )}
      </div>
    </div>
  );
}

