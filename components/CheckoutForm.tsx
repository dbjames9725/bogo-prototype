'use client';

import React, { useState } from 'react';

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

export default function CheckoutForm() {
  const [activePrice, setActivePrice] = useState<number>(125);
  const [dealType, setDealType] = useState<'BOGO_FREE' | 'BOGO_50'>('BOGO_FREE');
  const [selectedState, setSelectedState] = useState<string>('NY');
  const [includeTax, setIncludeTax] = useState<boolean>(false);

  // -------------------------------------------------------------
  // CLEAN PRE-TAX MATH ENGINE
  // -------------------------------------------------------------
  const itemPrice = Math.max(0.01, activePrice);

  // 1. Standard Retail Cost for TWO items ($125 * 2 = $250.00)
  const standardRetailCost2Items = itemPrice * 2;

  // 2. BOGO Promo Total (Pre-tax total for both items: $125.00 for BOGO Free)
  const isBogo50 = dealType === 'BOGO_50';
  const bogoPromoTotal = isBogo50 ? itemPrice * 1.5 : itemPrice;

  // 3. Your Split Share (Pre-tax share: $125 / 2 = $62.50)
  const yourSplitShare = bogoPromoTotal / 2;

  // 4. Platform Fee (5% of single retail item split: $125 * 0.05 / 2 = $3.13)
  const platformFee = (itemPrice * 0.05) / 2;

  // 5. Personal Savings per person
  const personalSavings = itemPrice - yourSplitShare;

  // 6. Optional Sales Tax (Only calculated if checkbox is selected)
  const stateInfo = STATE_TAX_RATES[selectedState] || { name: 'Default', rate: 0.07 };
  const estimatedTax = includeTax ? yourSplitShare * stateInfo.rate : 0;

  // 7. Stripe Processing Fee (2.9% + $0.30)
  const stripeFee = (yourSplitShare + estimatedTax) * 0.029 + 0.30;

  // 8. Total Amount Due per person
  const totalAmountDue = yourSplitShare + platformFee + estimatedTax + stripeFee;

  return (
    <div className="bg-white p-6 rounded-3xl shadow-md border border-gray-200 max-w-xl mx-auto space-y-6 text-gray-900 font-sans">
      {/* Header */}
      <div className="border-b border-gray-100 pb-4">
        <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-blue-600 tracking-wider">
          <span>🧮 Interactive Savings Simulator</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Adjust retail price & deal type to project your personal savings.
        </p>
      </div>

      {/* Inputs */}
      <div className="space-y-4">
        {/* Retail Price Input */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              Item Retail Price
            </label>
            <div className="flex items-center gap-1">
              <span className="text-sm font-bold text-gray-400">$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={activePrice}
                onChange={(e) => setActivePrice(parseFloat(e.target.value) || 0)}
                className="w-28 p-1.5 text-right font-black text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
            className="w-full accent-blue-600 cursor-pointer"
          />
          <div className="flex justify-between text-[11px] text-gray-400 font-semibold">
            <span>$10</span>
            <span>$250</span>
            <span>$500+</span>
          </div>
        </div>

        {/* Deal Mechanics Selector */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
            Select Deal Mechanics
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDealType('BOGO_FREE')}
              className={`py-2.5 px-3 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
                dealType === 'BOGO_FREE'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
              }`}
            >
              Buy 1 Get 1 FREE
            </button>
            <button
              type="button"
              onClick={() => setDealType('BOGO_50')}
              className={`py-2.5 px-3 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
                dealType === 'BOGO_50'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
              }`}
            >
              Buy 1 Get 1 50% OFF
            </button>
          </div>
        </div>
      </div>

      {/* Clean Line-Item Output Table */}
      <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 space-y-3 text-sm">
        <div className="flex justify-between text-gray-600">
          <span>Standard Retail Cost (2 Items)</span>
          <span className="font-semibold text-gray-900">
            ${standardRetailCost2Items.toFixed(2)}
          </span>
        </div>

        <div className="flex justify-between text-gray-600">
          <span>BOGO Promo Total (Pre-tax)</span>
          <span className="font-semibold text-gray-900">
            ${bogoPromoTotal.toFixed(2)}
          </span>
        </div>

        <div className="flex justify-between text-gray-600 pt-1 border-t border-gray-200">
          <span>Your Split Share (Pre-tax)</span>
          <span className="font-bold text-emerald-700 text-base">
            ${yourSplitShare.toFixed(2)}
          </span>
        </div>

        <div className="flex justify-between text-xs text-gray-500">
          <span>Platform Fee (5% Retail Split)</span>
          <span className="font-semibold">+${platformFee.toFixed(2)}</span>
        </div>

        {/* Optional Tax Toggle & State Selection */}
        <div className="pt-2 border-t border-gray-200 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="simulatorTaxToggle"
                checked={includeTax}
                onChange={(e) => setIncludeTax(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="simulatorTaxToggle" className="text-xs font-bold text-gray-700 cursor-pointer">
                Add State Sales Tax
              </label>
            </div>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
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
            <div className="flex justify-between text-xs text-gray-600">
              <span>Estimated {selectedState} Sales Tax</span>
              <span className="font-semibold">+${estimatedTax.toFixed(2)}</span>
            </div>
          )}
        </div>

        <div className="flex justify-between text-xs text-gray-500">
          <span>Stripe Processing Fee</span>
          <span className="font-semibold">+${stripeFee.toFixed(2)}</span>
        </div>

        {/* Total Due */}
        <div className="flex justify-between text-base font-black text-gray-900 pt-3 border-t border-gray-300">
          <span>Total Amount Due</span>
          <span className="text-blue-600">${totalAmountDue.toFixed(2)}</span>
        </div>
      </div>

      {/* Savings Banner */}
      <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl flex items-center justify-between">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider block text-emerald-600">
            Personal Savings Projection
          </span>
          <span className="text-lg font-black text-emerald-900">
            Save ${personalSavings.toFixed(2)} ({isBogo50 ? '25%' : '50%'} Off)
          </span>
        </div>
        <span className="text-2xl">🎉</span>
      </div>
    </div>
  );
}