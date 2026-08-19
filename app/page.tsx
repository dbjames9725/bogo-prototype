'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { calculateLocalTax, STATE_TAX_RATES } from '@/lib/tax';

export default function HomePage() {
  const router = useRouter();

  // Calculator State
  const [calcPrice, setCalcPrice] = useState<number>(120);
  const [calcDeal, setCalcDeal] = useState<'BOGO_FREE' | 'BOGO_50'>('BOGO_FREE');

  // Form State
  const [dealType, setDealType] = useState<'BOGO_FREE' | 'BOGO_50'>('BOGO_FREE');
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState<string>('120');
  const [stateCode, setStateCode] = useState('CA');
  const [includeTax, setIncludeTax] = useState(true);
  const [loading, setLoading] = useState(false);

  // Form Math Derivations
  const rawPrice = parseFloat(itemPrice) || 0;
  const taxInfo = calculateLocalTax(rawPrice, stateCode);
  const finalPrice = includeTax ? taxInfo.totalWithTax : rawPrice;

  // Split Logic
  const hostShare = dealType === 'BOGO_FREE' ? finalPrice / 2 : (finalPrice * 1.5) / 2;
  const partnerShare = hostShare;

  // Calculator Math Derivations
  const calcTaxInfo = calculateLocalTax(calcPrice, stateCode);
  const calcTotalWithTax = calcTaxInfo.totalWithTax;
  const calcFullRetailTwoItems = calcTotalWithTax * 2;
  const calcBogoTotal = calcDeal === 'BOGO_FREE' ? calcTotalWithTax : calcTotalWithTax * 1.5;
  const calcSplitPerPerson = calcBogoTotal / 2;
  const calcSavings = calcFullRetailTwoItems - calcBogoTotal;
  const calcSavingsPercent = calcDeal === 'BOGO_FREE' ? 50 : 25;

  async function handleCreateLobby(e: React.FormEvent) {
    e.preventDefault();
    if (!itemName || rawPrice <= 0) return;

    setLoading(true);

    try {
      const res = await fetch('/api/create-lobby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemName,
          itemPrice: finalPrice,
          dealType,
          userAShare: hostShare,
          userBShare: partnerShare,
        }),
      });

      const data = await res.json();
      if (res.ok && data.lobbyId) {
        router.push(`/lobby/${data.lobbyId}`);
      } else {
        alert(data.error || 'Failed to create lobby');
      }
    } catch (err) {
      console.error(err);
      alert('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }

  function applyCalculatorToForm() {
    setItemPrice(calcPrice.toString());
    setDealType(calcDeal);
    const formElement = document.getElementById('lobby-form');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth' });
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-10">
      {/* Hero Section */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full">
          <span>✨</span>
          <span>Zero Markups. Split Any Online Promo.</span>
        </div>
        <h1 className="text-4xl sm:text-6xl font-black text-gray-900 tracking-tight">
          Split Deals. Pay Half.
        </h1>
        <p className="text-base sm:text-lg text-gray-600 max-w-xl mx-auto leading-relaxed">
          Pair with verified buyers online to instantly split Buy 1 Get 1 Free & 50% Off promotions.
        </p>
      </div>

      {/* Sleek FinTech Calculator Widget */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-800 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>🧮</span> Interactive Savings Simulator
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Adjust retail price & deal type to project your personal savings.
            </p>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold px-3 py-1 rounded-full text-xs flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Save {calcSavingsPercent}% Per Item
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Controls Column */}
          <div className="lg:col-span-7 space-y-6">
            {/* Price Slider */}
            <div>
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  Item Retail Price
                </span>
                <span className="text-2xl font-black text-white">${calcPrice}</span>
              </div>
              <input
                type="range"
                min="10"
                max="500"
                step="5"
                value={calcPrice}
                onChange={(e) => setCalcPrice(Number(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                <span>$10</span>
                <span>$250</span>
                <span>$500</span>
              </div>
            </div>

            {/* Deal Segmented Control */}
            <div>
              <span className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">
                Select Deal Mechanics
              </span>
              <div className="grid grid-cols-2 gap-2 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
                <button
                  type="button"
                  onClick={() => setCalcDeal('BOGO_FREE')}
                  className={`py-2.5 px-3 rounded-lg text-xs font-semibold transition ${
                    calcDeal === 'BOGO_FREE'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Buy 1 Get 1 FREE
                </button>
                <button
                  type="button"
                  onClick={() => setCalcDeal('BOGO_50')}
                  className={`py-2.5 px-3 rounded-lg text-xs font-semibold transition ${
                    calcDeal === 'BOGO_50'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Buy 1 Get 1 50% OFF
                </button>
              </div>
            </div>
          </div>

          {/* Breakdown Card Column */}
          <div className="lg:col-span-5 bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50 space-y-5">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-xs">Standard Retail Cost (2 Items)</span>
                <span className="line-through font-mono">${calcFullRetailTwoItems.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center text-slate-300">
                <span className="text-xs font-medium">BOGO Promo Total (with Tax)</span>
                <span className="font-semibold font-mono text-white">${calcBogoTotal.toFixed(2)}</span>
              </div>

              <div className="pt-3 border-t border-slate-700 flex justify-between items-baseline">
                <div>
                  <span className="block text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    Your Split Share
                  </span>
                  <span className="text-[10px] text-slate-400">You pay only this amount</span>
                </div>
                <span className="text-3xl font-black text-emerald-400 font-mono">
                  ${calcSplitPerPerson.toFixed(2)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={applyCalculatorToForm}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-xl transition shadow-lg text-sm flex items-center justify-center gap-2 group"
            >
              <span>Lock In This Split</span>
              <span className="group-hover:translate-x-1 transition-transform">➔</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Creation Form */}
      <div id="lobby-form" className="bg-white rounded-3xl shadow-sm border border-gray-200 p-6 sm:p-10">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Create Your BOGO Split Lobby</h2>
          <p className="text-sm text-gray-500 mt-1">Set up your deal parameters and generate a shareable partner link.</p>
        </div>

        <form onSubmit={handleCreateLobby} className="space-y-6">
          {/* Deal Selector */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">Select Deal Type</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => setDealType('BOGO_FREE')}
                className={`p-4 rounded-2xl border-2 text-left transition flex flex-col justify-between ${
                  dealType === 'BOGO_FREE'
                    ? 'border-blue-600 bg-blue-50/50 text-blue-900'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                }`}
              >
                <div>
                  <span className="font-bold text-base sm:text-lg block">Buy 1 Get 1 FREE</span>
                  <span className="text-xs sm:text-sm text-gray-500">Split 100% of 1 item cost equally (50% each)</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDealType('BOGO_50')}
                className={`p-4 rounded-2xl border-2 text-left transition flex flex-col justify-between ${
                  dealType === 'BOGO_50'
                    ? 'border-blue-600 bg-blue-50/50 text-blue-900'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                }`}
              >
                <div>
                  <span className="font-bold text-base sm:text-lg block">Buy 1 Get 1 50% OFF</span>
                  <span className="text-xs sm:text-sm text-gray-500">
                    Split 150% of 1 item cost equally (75% each)
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Item Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Item Description</label>
              <input
                type="text"
                required
                placeholder="e.g. Nike Air Max Sneakers"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Item Retail Price ($)</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="120.00"
                value={itemPrice}
                onChange={(e) => setItemPrice(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
              />
            </div>
          </div>

          {/* State & Tax Calculations */}
          <div className="bg-gray-50 rounded-2xl p-4 sm:p-5 border border-gray-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="font-semibold text-gray-900 text-sm">Estimated Local Sales Tax</span>
                <p className="text-xs text-gray-500">Calculates state base sales tax into total deal split.</p>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={stateCode}
                  onChange={(e) => setStateCode(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[200px]"
                >
                  {Object.entries(STATE_TAX_RATES).map(([code, data]) => (
                    <option key={code} value={code}>
                      {data.name} ({data.rate === 0 ? 'No Tax' : `${(data.rate * 100).toFixed(2)}%`})
                    </option>
                  ))}
                </select>

                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeTax}
                    onChange={(e) => setIncludeTax(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span>Add Tax</span>
                </label>
              </div>
            </div>

            {rawPrice > 0 && (
              <div className="pt-3 border-t border-gray-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs sm:text-sm text-gray-700">
                <div>Subtotal: <span className="font-semibold">${rawPrice.toFixed(2)}</span></div>
                <div>
                  Tax ({(taxInfo.taxRate * 100).toFixed(2)}%):{' '}
                  <span className="font-semibold">${includeTax ? taxInfo.estimatedTax.toFixed(2) : '0.00'}</span>
                </div>
                <div>Total With Tax: <span className="font-semibold">${finalPrice.toFixed(2)}</span></div>
                <div className="text-blue-600 font-bold">Split Per Person: ${hostShare.toFixed(2)}</div>
              </div>
            )}
          </div>

          {/* Action Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-2xl shadow transition text-base sm:text-lg flex justify-center items-center"
          >
            {loading ? 'Creating Lobby...' : 'Start BOGO Split Lobby'}
          </button>
        </form>
      </div>
    </div>
  );
}