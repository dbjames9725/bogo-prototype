'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { calculateLocalTax, STATE_TAX_RATES } from '@/lib/tax';

export default function HomePage() {
  const router = useRouter();
 
  // Calculator state
  const [calcPrice, setCalcPrice] = useState<number>(120);
  const [calcDeal, setCalcDeal] = useState<'BOGO_FREE' | 'BOGO_50'>('BOGO_FREE');
 
  // Form state
  const [dealType, setDealType] = useState<'BOGO_FREE' | 'BOGO_50'>('BOGO_FREE');
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState<string>('120');
  const [stateCode, setStateCode] = useState('CA');
  const [includeTax, setIncludeTax] = useState(true);
  const [loading, setLoading] = useState(false);

  // Math derivations
  const rawPrice = parseFloat(itemPrice) || 0;
  const taxInfo = calculateLocalTax(rawPrice, stateCode);
  const finalPrice = includeTax ? taxInfo.totalWithTax : rawPrice;

  // Split Logic Calculations
  const hostShare = dealType === 'BOGO_FREE' ? finalPrice / 2 : (finalPrice * 1.5) / 2;
  const partnerShare = hostShare;

  // Calculator savings calculations
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
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-8">
      {/* Hero Section */}
      <div className="text-center">
        <span className="inline-block bg-blue-100 text-blue-800 text-xs font-extrabold px-3 py-1 rounded-full uppercase tracking-wider mb-3">
          🔥 Smart Deal Splitter
        </span>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-gray-900 tracking-tight">
          Split Deals. Double Your Savings.
        </h1>
        <p className="mt-2 text-base sm:text-lg text-gray-600 max-w-2xl mx-auto">
          Never pay full price again. Pair up with verified buyers to split BOGO promotions anywhere online.
        </p>
      </div>

      {/* Gamified Interactive Savings Calculator Widget */}
      <div className="bg-gradient-to-br from-gray-900 via-blue-950 to-indigo-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl border border-blue-800/40 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              ⚡ Live Savings Simulator
            </h2>
            <p className="text-xs sm:text-sm text-blue-200">
              Drag the sliders to see how much cash BOGO Split puts back in your pocket!
            </p>
          </div>
          <div className="bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-bold px-3 py-1 rounded-full text-xs flex items-center gap-1">
            <span className="animate-pulse">●</span> {calcSavingsPercent}% OFF INSTANTLY
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Controls */}
          <div className="space-y-4 bg-white/5 p-4 rounded-xl border border-white/10">
            <div>
              <div className="flex justify-between text-sm font-semibold mb-1">
                <span>Single Item Retail Price</span>
                <span className="text-emerald-400 font-bold">${calcPrice}</span>
              </div>
              <input
                type="range"
                min="10"
                max="500"
                step="5"
                value={calcPrice}
                onChange={(e) => setCalcPrice(Number(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Promotion Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCalcDeal('BOGO_FREE')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition border ${
                    calcDeal === 'BOGO_FREE'
                      ? 'bg-blue-600 border-blue-400 text-white shadow-lg'
                      : 'bg-gray-800/80 border-gray-700 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  Buy 1 Get 1 FREE
                </button>
                <button
                  type="button"
                  onClick={() => setCalcDeal('BOGO_50')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition border ${
                    calcDeal === 'BOGO_50'
                      ? 'bg-blue-600 border-blue-400 text-white shadow-lg'
                      : 'bg-gray-800/80 border-gray-700 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  Buy 1 Get 1 50% OFF
                </button>
              </div>
            </div>
          </div>

          {/* Dynamic Savings Card */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-5 border border-white/20 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-xs uppercase tracking-wider text-gray-300 font-semibold">
                  Full Retail (2 Items)
                </span>
                <span className="text-sm line-through text-gray-400">${calcFullRetailTwoItems.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-baseline">
                <span className="text-xs uppercase tracking-wider text-emerald-300 font-bold">
                  Your Split Share
                </span>
                <span className="text-2xl font-black text-emerald-400">${calcSplitPerPerson.toFixed(2)}</span>
              </div>

              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-center">
                <span className="text-xs text-emerald-200 block">Total Group Savings</span>
                <span className="text-xl font-extrabold text-emerald-300">${calcSavings.toFixed(2)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={applyCalculatorToForm}
              className="mt-4 w-full bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-black py-2.5 px-4 rounded-xl transition shadow-lg text-sm flex items-center justify-center gap-1"
            >
              🚀 Create Lobby with ${calcPrice} Deal ➔
            </button>
          </div>
        </div>
      </div>

      {/* Main Creation Form */}
      <div id="lobby-form" className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Create Your BOGO Split Lobby</h2>

        <form onSubmit={handleCreateLobby} className="space-y-6">
          {/* Deal Selector */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">Select Deal Type</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => setDealType('BOGO_FREE')}
                className={`p-4 rounded-xl border-2 text-left transition flex flex-col justify-between ${
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
                className={`p-4 rounded-xl border-2 text-left transition flex flex-col justify-between ${
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
              />
            </div>
          </div>

          {/* State & Tax Calculations */}
          <div className="bg-gray-50 rounded-xl p-4 sm:p-5 border border-gray-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="font-semibold text-gray-900 text-sm">Estimated Local Sales Tax</span>
                <p className="text-xs text-gray-500">Calculates state base sales tax into total deal split.</p>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={stateCode}
                  onChange={(e) => setStateCode(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[200px]"
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
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-6 rounded-xl shadow transition text-base sm:text-lg flex justify-center items-center"
          >
            {loading ? 'Creating Lobby...' : 'Start BOGO Split Lobby'}
          </button>
        </form>
      </div>
    </div>
  );
}
