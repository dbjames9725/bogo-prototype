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

export default function HomePage() {
  const router = useRouter();

  const [itemName, setItemName] = useState<string>('Premium Noise-Canceling Headphones');
  const [activePrice, setActivePrice] = useState<number>(120);
  const [dealType, setDealType] = useState<'BOGO_FREE' | 'BOGO_50'>('BOGO_FREE');
  const [selectedState, setSelectedState] = useState<string>('NY');
  const [includeTax, setIncludeTax] = useState<boolean>(false);

  const [isCreatingLobby, setIsCreatingLobby] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const itemPrice = Math.max(0.01, activePrice);
  const isBogo50 = dealType === 'BOGO_50';
  const bogoPromoTotal = isBogo50 ? itemPrice * 1.5 : itemPrice;
  const yourSplitShare = bogoPromoTotal / 2;
  const platformFee = (itemPrice * 0.05) / 2;

  const stateInfo = STATE_TAX_RATES[selectedState] || { name: 'Default', rate: 0.07 };
  const estimatedTax = includeTax ? yourSplitShare * stateInfo.rate : 0;
  const stripeFee = (yourSplitShare + estimatedTax) * 0.029 + 0.30;
  const totalAmountDue = yourSplitShare + platformFee + estimatedTax + stripeFee;

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
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.lobbyId) {
        throw new Error(data.error || 'Failed to initialize BOGO lobby');
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem(`hosted_${data.lobbyId}`, 'true');
      }

      router.push(`/lobby/${data.lobbyId}`);
    } catch (err: any) {
      console.error('Lock in Split Error:', err);
      setErrorMessage(err.message || 'Unable to create lobby. Please try again.');
      setIsCreatingLobby(false);
    }
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-white py-12 px-4 font-sans antialiased">
      <div className="max-w-xl mx-auto space-y-8">
       
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
            <span>⚡ BOGO Split Engine</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
            Split Any Deal 50/50
          </h1>
          <p className="text-sm text-neutral-400">
            Calculate exact split shares, fees, and state taxes in real time.
          </p>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-6">
          <div className="border-b border-neutral-800 pb-4">
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-blue-400 tracking-wider">
              <span>🧮 Interactive Savings Simulator</span>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Adjust retail price & deal type to project your personal savings.
            </p>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider block">
                Product Name / Item Description
              </label>
              <input
                type="text"
                placeholder="Enter product title..."
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                className="w-full p-3 bg-neutral-950 border border-neutral-800 rounded-xl text-sm font-semibold text-white placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                  Save {isBogo50 ? '25%' : '50%'} Per Item
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-bold text-neutral-400">Item Retail Price $</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={activePrice}
                    onChange={(e) => setActivePrice(parseFloat(e.target.value) || 0)}
                    className="w-28 p-1.5 text-right font-black text-lg bg-neutral-950 border border-neutral-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <input
                type="range"
                min="10"
                max="500"
                step="1"
                value={activePrice <= 500 ? activePrice : 500}
                onChange={(e) => setActivePrice(parseFloat(e.target.value) || 0)}
                className="w-full accent-blue-500 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-neutral-500 font-semibold">
                <span>$10</span>
                <span>$250</span>
                <span>$500+</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider block">
                Select Deal Mechanics
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDealType('BOGO_FREE')}
                  className={`py-3 px-3 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
                    dealType === 'BOGO_FREE'
                      ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                      : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:bg-neutral-800'
                  }`}
                >
                  Buy 1 Get 1 FREE
                </button>
                <button
                  type="button"
                  onClick={() => setDealType('BOGO_50')}
                  className={`py-3 px-3 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
                    dealType === 'BOGO_50'
                      ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                      : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:bg-neutral-800'
                  }`}
                >
                  Buy 1 Get 1 50% OFF
                </button>
              </div>
            </div>
          </div>

          <div className="bg-neutral-950 p-5 rounded-2xl border border-neutral-800 space-y-3 text-sm">
            <div className="flex justify-between text-neutral-400">
              <span>BOGO Promo Total (Pre-tax)</span>
              <span className="font-semibold text-white">
                ${bogoPromoTotal.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between text-neutral-400 pt-2 border-t border-neutral-800">
              <div>
                <span className="block font-bold text-white">Your Split Share</span>
                <span className="text-[11px] text-neutral-500">You pay only this amount (Pre-tax)</span>
              </div>
              <span className="font-black text-emerald-400 text-lg">
                ${yourSplitShare.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between text-xs text-neutral-400">
              <span>Platform Fee (5% Retail Split)</span>
              <span className="font-semibold text-neutral-300">+${platformFee.toFixed(2)}</span>
            </div>

            <div className="pt-2 border-t border-neutral-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="pageTaxToggleDark"
                    checked={includeTax}
                    onChange={(e) => setIncludeTax(e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-neutral-900 border-neutral-700 rounded focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="pageTaxToggleDark" className="text-xs font-bold text-neutral-300 cursor-pointer">
                    Add State Sales Tax
                  </label>
                </div>
                <select
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                  className="text-xs bg-neutral-900 border border-neutral-800 rounded px-2 py-1 font-bold text-white focus:outline-none"
                >
                  {Object.keys(STATE_TAX_RATES).sort().map((st) => (
                    <option key={st} value={st}>
                      {st} ({(STATE_TAX_RATES[st].rate * 100).toFixed(2)}%)
                    </option>
                  ))}
                </select>
              </div>

              {includeTax && (
                <div className="flex justify-between text-xs text-neutral-400">
                  <span>Estimated {selectedState} Sales Tax</span>
                  <span className="font-semibold text-neutral-300">+${estimatedTax.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className="flex justify-between text-xs text-neutral-400">
              <span>Stripe Processing Fee</span>
              <span className="font-semibold text-neutral-300">+${stripeFee.toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-base font-black text-white pt-3 border-t border-neutral-800">
              <span>Total Amount Due</span>
              <span className="text-blue-400">${totalAmountDue.toFixed(2)}</span>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl font-semibold text-center">
              ⚠️ {errorMessage}
            </div>
          )}

          <button
            type="button"
            onClick={handleLockInSplit}
            disabled={isCreatingLobby}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer text-base disabled:opacity-50"
          >
            {isCreatingLobby ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Creating BOGO Lobby...</span>
              </div>
            ) : (
              <>
                <span>Lock In This Split</span>
                <span>➔</span>
              </>
            )}
          </button>
        </div>

      </div>
    </main>
  );
}
