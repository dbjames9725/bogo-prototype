'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

const STATE_TAX_RATES: Record<string, { name: string; rate: number }> = {
  AL: { name: 'Alabama', rate: 0.0924 }, AK: { name: 'Alaska', rate: 0.0181 }, AZ: { name: 'Arizona', rate: 0.0837 },
  AR: { name: 'Arkansas', rate: 0.0944 }, CA: { name: 'California', rate: 0.0885 }, CO: { name: 'Colorado', rate: 0.0778 },
  CT: { name: 'Connecticut', rate: 0.0635 }, DE: { name: 'Delaware', rate: 0.0000 }, DC: { name: 'District of Columbia', rate: 0.0600 },
  FL: { name: 'Florida', rate: 0.0700 }, GA: { name: 'Georgia', rate: 0.0738 }, HI: { name: 'Hawaii', rate: 0.0444 },
  ID: { name: 'Idaho', rate: 0.0603 }, IL: { name: 'Illinois', rate: 0.0884 }, IN: { name: 'Indiana', rate: 0.0700 },
  IA: { name: 'Iowa', rate: 0.0694 }, KS: { name: 'Kansas', rate: 0.0865 }, KY: { name: 'Kentucky', rate: 0.0600 },
  LA: { name: 'Louisiana', rate: 0.0956 }, ME: { name: 'Maine', rate: 0.0550 }, MD: { name: 'Maryland', rate: 0.0600 },
  MA: { name: 'Massachusetts', rate: 0.0625 }, MI: { name: 'Michigan', rate: 0.0600 }, MN: { name: 'Minnesota', rate: 0.0803 },
  MS: { name: 'Mississippi', rate: 0.0707 }, MO: { name: 'Missouri', rate: 0.0833 }, MT: { name: 'Montana', rate: 0.0000 },
  NE: { name: 'Nebraska', rate: 0.0697 }, NV: { name: 'Nevada', rate: 0.0823 }, NH: { name: 'New Hampshire', rate: 0.0000 },
  NJ: { name: 'New Jersey', rate: 0.0660 }, NM: { name: 'New Mexico', rate: 0.0772 }, NY: { name: 'New York', rate: 0.0853 },
  NC: { name: 'North Carolina', rate: 0.0698 }, ND: { name: 'North Dakota', rate: 0.0696 }, OH: { name: 'Ohio', rate: 0.0724 },
  OK: { name: 'Oklahoma', rate: 0.0899 }, OR: { name: 'Oregon', rate: 0.0000 }, PA: { name: 'Pennsylvania', rate: 0.0634 },
  RI: { name: 'Rhode Island', rate: 0.0700 }, SC: { name: 'South Carolina', rate: 0.0744 }, SD: { name: 'South Dakota', rate: 0.0611 },
  TN: { name: 'Tennessee', rate: 0.0955 }, TX: { name: 'Texas', rate: 0.0820 }, UT: { name: 'Utah', rate: 0.0722 },
  VT: { name: 'Vermont', rate: 0.0636 }, VA: { name: 'Virginia', rate: 0.0577 }, WA: { name: 'Washington', rate: 0.0938 },
  WV: { name: 'West Virginia', rate: 0.0657 }, WI: { name: 'Wisconsin', rate: 0.0543 }, WY: { name: 'Wyoming', rate: 0.0536 },
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

const PRESET_PRICES = [25, 50, 100, 150, 200, 500];

export default function HomePage() {
  const router = useRouter();

  const [itemName, setItemName] = useState<string>('Premium Noise-Canceling Headphones');
  const [activePrice, setActivePrice] = useState<number>(120);
  const [dealType, setDealType] = useState<'BOGO_FREE' | 'BOGO_50'>('BOGO_FREE');
  const [selectedState, setSelectedState] = useState<string>('NY');
  const [includeTax, setIncludeTax] = useState<boolean>(true);
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_ROSTER[0]);

  const [isCreatingLobby, setIsCreatingLobby] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const [avatarStage, setAvatarStage] = useState<'idle' | 'walking' | 'pointing'>('idle');

  const itemPrice = Math.max(0.01, activePrice);
  const isBogo50 = dealType === 'BOGO_50';
  const bogoPromoTotal = isBogo50 ? itemPrice * 1.5 : itemPrice;
  const yourSplitShare = bogoPromoTotal / 2;

  const platformFee = Math.round(yourSplitShare * 0.025 * 100) / 100;
  const stateInfo = STATE_TAX_RATES[selectedState] || { name: 'Default', rate: 0.0853 };
  const estimatedTax = includeTax ? Math.round(yourSplitShare * stateInfo.rate * 100) / 100 : 0;
  const stripeFee = Math.round((yourSplitShare * 0.029 + 0.30) * 100) / 100;

  const totalAmountDue = yourSplitShare + platformFee + estimatedTax + stripeFee;

  const handleAvatarSelect = (av: typeof AVATAR_ROSTER[0]) => {
    setSelectedAvatar(av);
    triggerWalkAndPoint();
  };

  const triggerWalkAndPoint = () => {
    setAvatarStage('walking');
    setTimeout(() => {
      setAvatarStage('pointing');
    }, 600);
  };

  const handleLockInSplit = async () => {
    setIsCreatingLobby(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/create-lobby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemName,
          itemPrice,
          dealType,
          userState: selectedState,
          includeTax,
          hostAvatar: selectedAvatar.id,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.lobbyId) {
        throw new Error(data.error || 'Failed to initialize BOGO lobby');
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem(`hosted_${data.lobbyId}`, 'true');
        localStorage.setItem(`avatar_${data.lobbyId}`, selectedAvatar.id);
      }

      router.push(`/lobby/${data.lobbyId}`);
    } catch (err: any) {
      console.error('Lock in Split Error:', err);
      setErrorMessage(err.message || 'Unable to create lobby. Please try again.');
      setIsCreatingLobby(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white py-8 px-4 font-sans antialiased flex flex-col items-center justify-center">
      <div className="max-w-xl w-full mx-auto space-y-6 relative">

        {/* GAMIFIED HEADER */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-black text-xs font-black uppercase tracking-widest shadow-md shadow-amber-500/10">
            <span>⚔️ CO-OP BOGO SIMULATOR</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl uppercase">
            SPLIT ANY DEAL 50/50
          </h1>
          <p className="text-xs text-neutral-400">
            Calculate exact split shares, state taxes, and summon Player 2 in real time.
          </p>
        </div>

        <div className="bg-neutral-950 border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">

          {/* ITEM NAME INPUT */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase text-amber-400 tracking-wider block">
              Quest Target (Item Title)
            </label>
            <input
              type="text"
              placeholder="Enter product title..."
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className="w-full p-3 bg-neutral-900 border border-neutral-800 rounded-xl text-sm font-semibold text-white placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          {/* RETAIL PRICE DIRECT INPUT & QUICK POWER-UP CHIPS */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-xs font-black uppercase text-amber-400 tracking-wider">
                Retail Price ($USD)
              </label>
              <span className="text-xs font-extrabold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                Save {isBogo50 ? '25%' : '50%'} Per Item
              </span>
            </div>

            <div className="relative">
              <span className="absolute left-3.5 top-3 text-neutral-500 font-bold text-base">$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={activePrice || ''}
                onChange={(e) => {
                  setActivePrice(parseFloat(e.target.value) || 0);
                  if (avatarStage === 'idle') triggerWalkAndPoint();
                }}
                placeholder="120.00"
                className="w-full pl-8 p-3 text-lg font-mono font-black bg-neutral-900 border border-neutral-800 rounded-xl text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            {/* QUICK POWER-UP CHIPS */}
            <div className="flex flex-wrap gap-2 pt-1">
              {PRESET_PRICES.map((price) => (
                <button
                  key={price}
                  type="button"
                  onClick={() => {
                    setActivePrice(price);
                    triggerWalkAndPoint();
                  }}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-extrabold transition cursor-pointer ${
                    activePrice === price
                      ? 'border-amber-400 bg-amber-400 text-black shadow-md shadow-amber-400/20'
                      : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700 hover:text-white'
                  }`}
                >
                  ${price}
                </button>
              ))}
            </div>
          </div>

          {/* DEAL MECHANICS SELECTOR */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase text-amber-400 tracking-wider block">
              Select Deal Mechanics
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDealType('BOGO_FREE')}
                className={`py-3 px-3 rounded-xl text-xs font-black uppercase border transition cursor-pointer ${
                  dealType === 'BOGO_FREE'
                    ? 'bg-amber-400 text-black border-amber-400 shadow-md shadow-amber-400/10'
                    : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:bg-neutral-800'
                }`}
              >
                Buy 1 Get 1 FREE
              </button>
              <button
                type="button"
                onClick={() => setDealType('BOGO_50')}
                className={`py-3 px-3 rounded-xl text-xs font-black uppercase border transition cursor-pointer ${
                  dealType === 'BOGO_50'
                    ? 'bg-amber-400 text-black border-amber-400 shadow-md shadow-amber-400/10'
                    : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:bg-neutral-800'
                }`}
              >
                Buy 1 Get 1 50% OFF
              </button>
            </div>
          </div>

          {/* AVATAR SELECTOR (PLAYER 1) */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-black uppercase text-amber-400 tracking-wider">
                Select Your Hero (Player 1)
              </label>
              <span className="text-[10px] text-neutral-400 font-semibold">{selectedAvatar.role}</span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {AVATAR_ROSTER.map((av) => (
                <button
                  key={av.id}
                  type="button"
                  onClick={() => handleAvatarSelect(av)}
                  className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                    selectedAvatar.id === av.id
                      ? 'border-amber-400 bg-amber-500/20 text-white scale-105 shadow-lg shadow-amber-500/10'
                      : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  <div className="text-2xl mb-1">{av.icon}</div>
                  <div className="text-[10px] font-extrabold truncate">{av.name}</div>
                </button>
              ))}
            </div>

            <div className="bg-neutral-900/50 p-2.5 rounded-xl border border-neutral-800 text-center">
              <span className="text-[11px] text-amber-300 font-semibold italic">
                "{selectedAvatar.quote}"
              </span>
            </div>
          </div>

          {/* FEE & PRICE BREAKDOWN SUMMARY */}
          <div className="bg-neutral-900 p-5 rounded-2xl border border-neutral-800 space-y-3 text-xs">
            <div className="text-[10px] font-black uppercase tracking-wider text-amber-400 border-b border-neutral-800 pb-2">
              Loot & XP Breakdown
            </div>

            <div className="flex justify-between text-neutral-400">
              <span>BOGO Promo Total (Pre-tax)</span>
              <span className="font-mono text-neutral-300">${bogoPromoTotal.toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-neutral-300 pt-2 border-t border-neutral-800">
              <div>
                <span className="block font-extrabold text-white">Your Player 1 Share</span>
                <span className="text-[10px] text-neutral-500">Base split cost (Pre-tax)</span>
              </div>
              <span className="font-black text-emerald-400 text-base font-mono">
                ${yourSplitShare.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between text-neutral-400">
              <span>Platform Fee (2.5% Retail Split)</span>
              <span className="font-mono text-neutral-300">+${platformFee.toFixed(2)}</span>
            </div>

            <div className="pt-2 border-t border-neutral-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="pageTaxToggleDark"
                    checked={includeTax}
                    onChange={(e) => setIncludeTax(e.target.checked)}
                    className="w-4 h-4 text-amber-500 bg-neutral-950 border-neutral-700 rounded focus:ring-amber-400 cursor-pointer"
                  />
                  <label htmlFor="pageTaxToggleDark" className="text-xs font-bold text-neutral-300 cursor-pointer">
                    Add State Sales Tax
                  </label>
                </div>

                <select
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                  className="text-xs bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1 font-bold text-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                >
                  {Object.keys(STATE_TAX_RATES).sort().map((st) => (
                    <option key={st} value={st}>
                      {st} ({(STATE_TAX_RATES[st].rate * 100).toFixed(2)}%)
                    </option>
                  ))}
                </select>
              </div>

              {includeTax && (
                <div className="flex justify-between text-neutral-400">
                  <span>Estimated Sales Tax ({selectedState})</span>
                  <span className="font-mono text-neutral-300">+${estimatedTax.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-neutral-400">
                <span>Stripe Processing Fee</span>
                <span className="font-mono text-neutral-300">+${stripeFee.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex justify-between text-emerald-400 font-bold border-t border-neutral-800 pt-3 text-sm">
              <span>Est. Total Authorized Hold:</span>
              <span className="font-mono text-base">${totalAmountDue.toFixed(2)}</span>
            </div>
          </div>

          {errorMessage && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-xl font-semibold">
              {errorMessage}
            </div>
          )}

          {/* ANIMATED GUIDING AVATAR WITH CUSTOM MESSAGE */}
          {avatarStage !== 'idle' && (
            <div className="flex items-center justify-center gap-2 pt-2 transition-all duration-500 animate-bounce">
              <div className="bg-amber-400 text-black text-[11px] font-black px-3.5 py-2 rounded-xl shadow-lg border border-amber-300 flex items-center gap-1.5">
                <span className="text-sm">{selectedAvatar.icon}</span>
                <span>Click here when ready to save some money!</span>
                <span className="text-base">👇</span>
              </div>
            </div>
          )}

          {/* SUBMIT LAUNCH BUTTON */}
          <button
            type="button"
            onClick={handleLockInSplit}
            disabled={isCreatingLobby || itemPrice <= 0}
            className="w-full py-4 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:brightness-110 text-black font-black uppercase tracking-wider rounded-xl shadow-lg shadow-amber-500/10 transition duration-200 text-base cursor-pointer transform active:scale-95 disabled:opacity-50"
          >
            {isCreatingLobby ? 'INITIALIZING MATCH...' : '🎮 LAUNCH CO-OP LOBBY'}
          </button>
        </div>
      </div>
    </main>
  );
}
