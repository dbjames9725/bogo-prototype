'use client';

import Script from 'next/script';
import Link from 'next/link';

export default function MerchantDemoPage() {
  return (
    <div className="min-h-screen bg-gray-100 py-10 px-4 sm:px-6 font-sans">
      {/* Top Banner */}
      <div className="max-w-4xl mx-auto mb-6 bg-amber-500 text-white p-4 rounded-2xl shadow-sm flex items-center justify-between text-xs sm:text-sm font-semibold">
        <span>🛍️ DEMO MERCHANT STORE: NIKE BOGO PROMOTION</span>
        <Link href="/" className="underline hover:text-amber-100">
          Back to BOGO Split App ➔
        </Link>
      </div>

      {/* Simulated Store Product Card */}
      <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-lg border border-gray-200 overflow-hidden grid grid-cols-1 md:grid-cols-2">
        {/* Product Image */}
        <div className="bg-gray-50 p-8 flex items-center justify-center border-b md:border-b-0 md:border-r border-gray-200">
          <div className="text-center space-y-4">
            <div className="text-8xl">👟</div>
            <span className="inline-block bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              Buy 1 Get 1 Free Promo
            </span>
          </div>
        </div>

        {/* Product Details & Purchase Form */}
        <div className="p-6 sm:p-8 space-y-6 flex flex-col justify-between">
          <div className="space-y-3">
            <span className="text-xs font-bold uppercase text-gray-400 tracking-wider">
              Footwear / Running
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 product-title">
              Nike Air Zoom Pegasus 40
            </h1>
            <p className="text-xs text-gray-500">
              High-performance daily trainer engineered with responsive Zoom Air cushioning.
            </p>

            <div className="flex items-baseline gap-3 pt-2">
              <span className="text-3xl font-black text-gray-900 product-price">$130.00</span>
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
                In Stock & Eligible for BOGO
              </span>
            </div>
          </div>

          {/* Standard Add to Cart Form */}
          <div className="space-y-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              className="w-full bg-gray-900 hover:bg-black text-white font-bold py-3.5 px-4 rounded-xl transition text-sm add-to-cart"
            >
              Add to Cart ($130.00)
            </button>

            {/* The BOGO Widget Script automatically injects the "Split This Deal" button right here! */}
          </div>

          <div className="pt-2 text-[11px] text-gray-400 text-center">
            🔒 Standard 30-day Merchant Return Policy Applies
          </div>
        </div>
      </div>

      {/* Embed the BOGO Split Widget Script */}
      <Script src="/bogo-widget.js" strategy="afterInteractive" />
    </div>
  );
}
