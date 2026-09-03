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
      <div className="bg-gray-50 p-4 rounded-xl space-y-3 border border-gray-200">
        <h4 className="text-xs font-bold uppercase text-gray-500 tracking-wider">
          Shipping & Billing Address
        </h4>
        <div>
          <label className="block text-[11px] font-semibold text-gray-600 mb-1">Full Name</label>
          <input
            type="text"
            placeholder="Jane Doe"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-2.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-gray-600 mb-1">Street Address</label>
          <input
            type="text"
            placeholder="123 Main St, Apt 4B"
            required
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            className="w-full p-2.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1">City</label>
            <input
              type="text"
              placeholder="New York"
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full p-2.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1">State</label>
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="w-full p-2.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
            >
              {Object.keys(STATE_TAX_RATES).sort().map((st) => (
                <option key={st} value={st}>
                  {st} - {STATE_TAX_RATES[st].name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1">ZIP Code</label>
            <input
              type="text"
              placeholder="10001"
              required
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              className="w-full p-2.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-gray-600 mb-1">Phone Number</label>
          <input
            type="tel"
            placeholder="(555) 000-0000"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full p-2.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
        <h4 className="text-xs font-bold uppercase text-gray-500 tracking-wider mb-3">
          Payment Method
        </h4>
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
        className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg transition disabled:opacity-50 text-base cursor-pointer"
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

  // Dynamic Retail Price, Tax Toggle & State Selector
  const [activePrice, setActivePrice] = useState<number>(115);
  const [selectedState, setSelectedState] = useState<string>('NY');
  const [includeTax, setIncludeTax] = useState<boolean>(false);

  const updatePaymentIntentServer = async (newPrice: number, newState: string, withTax: boolean) => {
    if (!lobby || lobby.host_payment_intent_id) return;
    try {
      const res = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lobbyId,
          role,
          customPrice: newPrice,
          userState: newState,
          includeTax: withTax,
        }),
      });
      const intentData = await res.json();
      if (intentData.clientSecret) {
        setClientSecret(intentData.clientSecret);
      }
    } catch (err) {
      console.error('Error updating PaymentIntent dynamically:', err);
    }
  };

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
      const initialPrice = data.item_price || 115;
      setActivePrice(initialPrice);

      const isHostStored = typeof window !== 'undefined' && localStorage.getItem(`hosted_${lobbyId}`) === 'true';
      const isHost = isHostStored || !data.host_payment_intent_id;
      const currentRole = isHost ? 'HOST' : 'PARTNER';

      if (isHost && typeof window !== 'undefined') {
        localStorage.setItem(`hosted_${lobbyId}`, 'true');
      }

      setRole(currentRole);

      const hasHostPaid = !!data.host_payment_intent_id;
      const hasPartnerPaid = !!data.partner_payment_intent_id;
      const hasUserPaidForRole = isHost ? hasHostPaid : hasPartnerPaid;

      if (!hasUserPaidForRole && data.status !== 'MATCHED') {
        await updatePaymentIntentServer(initialPrice, selectedState, includeTax);
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
          if (updated.item_price) setActivePrice(updated.item_price);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [lobbyId]);

  const handlePriceChange = (val: number) => {
    const validPrice = Math.max(0.01, val);
    setActivePrice(validPrice);
    updatePaymentIntentServer(validPrice, selectedState, includeTax);
  };

  const handleStateChange = (st: string) => {
    setSelectedState(st);
    updatePaymentIntentServer(activePrice, st, includeTax);
  };

  const handleTaxToggle = (checked: boolean) => {
    setIncludeTax(checked);
    updatePaymentIntentServer(activePrice, selectedState, checked);
  };

  const copyInviteLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500 font-sans">
        <div className="flex items-center gap-3 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="font-semibold text-sm">Loading BOGO Split Lobby...</span>
        </div>
      </div>
    );
  }

  if (fetchError || !lobby) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4 font-sans text-gray-900">
        <div className="max-w-md bg-white p-8 rounded-3xl shadow-md border border-gray-200 text-center space-y-4">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-xl font-extrabold">Lobby Not Found</h2>
          <p className="text-xs text-gray-500">{fetchError || 'Unable to locate this lobby.'}</p>
        </div>
      </div>
    );
  }

  // DYNAMIC MATH ENGINE
  const dealType = (lobby.deal_type || 'BOGO').toUpperCase();
  const isBogo50 = dealType === 'BOGO_50' || dealType === 'BUY_1_GET_1_50_OFF';

  // 1. Standard Retail Cost (2 Items) - Directly reflects Item Retail Price
  const standardRetailCost2Items = activePrice;

  // 2. BOGO Promo Total (Pre-tax total for both items)
  const bogoPromoTotal = isBogo50 ? activePrice * 1.5 : activePrice;

  // 3. Your Split Share (Pre-tax base share per person)
  const baseShare = bogoPromoTotal / 2;

  // 4. Platform Fee = 5% of single item retail price split in half
  const platformFee = (activePrice * 0.05) / 2;

  // 5. Dynamic State Tax (Only applied if includeTax box is checked)
  const stateInfo = STATE_TAX_RATES[selectedState] || { name: 'Default', rate: 0.07 };
  const estimatedTax = includeTax ? baseShare * stateInfo.rate : 0;

  // 6. Stripe Processing Fee
  const stripeFee = (baseShare + estimatedTax) * 0.029 + 0.30;

  // 7. Total Amount Due per person
  const totalShare = baseShare + platformFee + estimatedTax + stripeFee;

  const isHost = role === 'HOST';
  const hasHostPaid = !!lobby.host_payment_intent_id;
  const hasPartnerPaid = !!lobby.partner_payment_intent_id;
  const isMatched = lobby.status === 'MATCHED' && hasHostPaid && hasPartnerPaid;

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 font-sans text-gray-900">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex items-center justify-between">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">
              {isHost ? '👑 HOST DASHBOARD' : '🤝 PARTNER DEAL INVITATION'}
            </span>
            <h2 className="text-xl font-extrabold mt-2 text-gray-900">{lobby.item_name}</h2>
          </div>
          <div className="text-right">
            <span className="text-xs text-gray-400 block font-semibold">Deal Type</span>
            <span className="text-sm font-bold text-emerald-600">
              {isBogo50 ? 'Buy 1 Get 1 50% Off' : 'Buy 1 Get 1 Free'}
            </span>
          </div>
        </div>

        {/* Dynamic Retail Price & Simulator Controls */}
        {!isMatched && !hasHostPaid && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200 space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-xs font-extrabold uppercase text-gray-500 tracking-wider">
                Interactive Savings Simulator (Item Retail Price)
              </label>
              <div className="flex items-center gap-1">
                <span className="text-sm font-bold text-gray-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={activePrice}
                  onChange={(e) => handlePriceChange(parseFloat(e.target.value) || 0)}
                  className="w-28 p-1.5 text-right font-black text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <input
              type="range"
              min="5"
              max="1000"
              step="1"
              value={activePrice <= 1000 ? activePrice : 1000}
              onChange={(e) => handlePriceChange(parseFloat(e.target.value) || 0)}
              className="w-full accent-blue-600 cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-gray-400 font-semibold">
              <span>$5</span>
              <span>$500</span>
              <span>$1,000+</span>
            </div>
          </div>
        )}

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
            <h3 className="text-base font-extrabold border-b border-gray-100 pb-3 flex justify-between items-center">
              <span>Price Breakdown (Per Person)</span>
            </h3>

            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Standard Retail Cost (2 Items)</span>
                <span className="font-semibold text-gray-900">
                  ${standardRetailCost2Items.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>BOGO Promo Total (2 Items, Pre-tax)</span>
                <span className="font-semibold text-gray-900">${bogoPromoTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Your Split Share (Pre-tax)</span>
                <span className="font-bold text-emerald-700">${baseShare.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Platform Fee (5% Retail Split)</span>
                <span className="font-semibold">+${platformFee.toFixed(2)}</span>
              </div>

              {/* State Selection & Add Tax Checkbox */}
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="addTaxToggle"
                      checked={includeTax}
                      onChange={(e) => handleTaxToggle(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                    />
                    <label htmlFor="addTaxToggle" className="text-xs font-bold text-gray-700 cursor-pointer">
                      Add State Sales Tax
                    </label>
                  </div>
                  <select
                    value={selectedState}
                    onChange={(e) => handleStateChange(e.target.value)}
                    className="text-xs bg-white border border-gray-300 rounded px-2 py-1 font-bold text-gray-800"
                  >
                    {Object.keys(STATE_TAX_RATES).sort().map((st) => (
                      <option key={st} value={st}>
                        {st} ({(STATE_TAX_RATES[st].rate * 100).toFixed(2)}%)
                      </option>
                    ))}
                  </select>
                </div>
                {includeTax && (
                  <div className="flex justify-between text-xs text-gray-600 pt-1 border-t border-gray-200">
                    <span>Estimated {selectedState} Sales Tax</span>
                    <span className="font-semibold">+${estimatedTax.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between text-gray-600">
                <span>Stripe Processing Fee</span>
                <span className="font-semibold">+${stripeFee.toFixed(2)}</span>
              </div>

              <div className="flex justify-between text-base font-black text-gray-900 pt-3 border-t border-gray-100">
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
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition shadow-sm cursor-pointer"
            >
              {copied ? '✓ Invite Link Copied!' : 'Copy Invite Link'}
            </button>
          </div>
        )}

        {!isMatched && (
          <div className="bg-white p-6 rounded-3xl shadow-md border border-gray-200 space-y-4">
            {(isHost && !hasHostPaid) || (!isHost && !hasPartnerPaid) ? (
              <>
                <h3 className="text-lg font-extrabold text-gray-900 border-b border-gray-100 pb-3">
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
