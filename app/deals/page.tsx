'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface Deal {
  id: string;
  store_name: string;
  store_logo: string;
  deal_title: string;
  affiliate_url: string;
  badge: string;
}

export default function DealsHubPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDeals() {
      const { data, error } = await supabase
        .from('store_deals')
        .select('*')
        .eq('is_active', true);

      if (!error && data) {
        setDeals(data);
      }
      setLoading(false);
    }
    fetchDeals();
  }, []);

  return (
    <main className="min-h-screen bg-black text-white p-6 md:p-12 font-sans">
      {/* HEADER NAV */}
      <div className="max-w-5xl mx-auto flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-white flex items-center gap-2">
            <span>🔥</span> Verified Store BOGO Hub
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Tap any store icon to claim active BOGO offers directly at checkout.
          </p>
        </div>
        <Link
          href="/"
          className="text-xs font-bold bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 px-4 py-2.5 rounded-xl transition"
        >
          ← Co-Op Simulator
        </Link>
      </div>

      <div className="max-w-5xl mx-auto">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-44 bg-neutral-900/60 rounded-3xl border border-neutral-800"></div>
            ))}
          </div>
        ) : (
          /* APP GRID LAYOUT (DESKTOP / MOBILE APP ICONS) */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
            {deals.map((deal) => (
              <a
                key={deal.id}
                href={deal.affiliate_url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative bg-neutral-900/80 hover:bg-neutral-800/90 border border-neutral-800 hover:border-amber-400/50 p-5 rounded-3xl transition-all duration-300 flex flex-col items-center text-center shadow-xl hover:shadow-amber-500/10 hover:-translate-y-1"
              >
                {/* PROMO BADGE */}
                <span className="absolute top-3 right-3 text-[9px] font-black uppercase tracking-wider bg-amber-400 text-black px-2 py-0.5 rounded-full shadow-sm">
                  {deal.badge}
                </span>

                {/* APP ICON CONTAINER WITH LOGO */}
                <div className="w-20 h-20 bg-neutral-950 border border-neutral-800 group-hover:border-neutral-700 rounded-2xl flex items-center justify-center p-3 mb-3 shadow-inner group-hover:scale-105 transition-transform">
                  {deal.store_logo ? (
                    <img
                      src={deal.store_logo}
                      alt={`${deal.store_name} logo`}
                      className="max-h-12 max-w-12 object-contain"
                    />
                  ) : (
                    <span className="text-2xl font-black text-amber-400">
                      {deal.store_name.charAt(0)}
                    </span>
                  )}
                </div>

                {/* STORE NAME & OFFER */}
                <h2 className="text-sm font-extrabold text-white group-hover:text-amber-300 transition-colors">
                  {deal.store_name}
                </h2>
                <p className="text-[11px] text-neutral-400 font-medium line-clamp-2 mt-1">
                  {deal.deal_title}
                </p>

                {/* ACTION CALLOUT */}
                <div className="mt-4 w-full py-2 bg-neutral-950 group-hover:bg-amber-400 group-hover:text-black border border-neutral-800 group-hover:border-amber-400 text-neutral-300 text-xs font-black rounded-xl transition-all">
                  Shop Deal ↗
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
