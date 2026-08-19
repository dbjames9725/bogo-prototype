'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { calculateLocalTax, STATE_TAX_RATES } from '@/lib/tax';

export default function HomePage() {
  const router = useRouter();
  const [dealType, setDealType] = useState<'BOGO_FREE' | 'BOGO_50'>('BOGO_FREE');
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState<string>('');
  const [stateCode, setStateCode] = useState('CA');
  const [includeTax, setIncludeTax] = useState(true);
  const [loading, setLoading] = useState(false);

  const rawPrice = parseFloat(itemPrice) || 0;
  const taxInfo = calculateLocalTax(rawPrice, stateCode);
  const finalPrice = includeTax ? taxInfo.totalWithTax : rawPrice;

  // Split Logic Calculations
  const hostShare = dealType === 'BOGO_FREE' ? finalPrice / 2 : (finalPrice * 1.5) / 2;
  const partnerShare = hostShare;

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

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
      {/* Hero Section */}
      <div className="text-center mb-6 sm:mb-10">
        <h1 className="text-3xl sm:text-5xl font-extrabold text-gray-900 tracking-tight">
          Split Deals. Save Money.
        </h1>
        <p className="mt-2 text-base sm:text-lg text-gray-600 max-w-2xl mx-auto">
          Pair up with buyers online to split Buy 1 Get 1 Free or 50% Off promotions easily.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm sm:shadow-md border border-gray-200 p-4 sm:p-8">
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
                placeholder="100.00"
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
                {/* 50 States + DC Dynamic Dropdown */}
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
