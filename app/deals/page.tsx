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
    <main className="min-h-screen bg-black text-white px-4 py-6 font-sans flex flex-col justify-between max-w-md mx-auto relative overflow-hidden select-none">
     
      {/* TOP STATUS & NAVIGATION BAR */}
      <div className="w-full flex justify-between items-center mb-6 pt-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-xs font-black tracking-wider uppercase text-neutral-300">
            BOGO App Dock
          </span>
        </div>
        <Link
          href="/"
          className="text-[11px] font-extrabold bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 px-3.5 py-1.5 rounded-full transition shadow-sm"
        >
          ← Simulator
        </Link>
      </div>

      {/* HEADER BANNER */}
      <div className="text-center mb-6 space-y-1">
        <h1 className="text-xl font-black uppercase tracking-tight text-white flex items-center justify-center gap-2">
          <span>🎁</span> BOGO Store Apps
        </h1>
        <p className="text-[11px] text-neutral-400 font-medium">
          Tap any store icon to claim live BOGO offers directly
        </p>
      </div>

      {/* NATIVE iOS STYLE APP GRID (FIXED 4 COLUMNS) */}
      <div className="flex-1 flex items-center justify-center py-4">
        {loading ? (
          <div className="grid grid-cols-4 gap-y-6 gap-x-4 w-full animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 bg-neutral-900 rounded-2xl border border-neutral-800"></div>
                <div className="w-12 h-3 bg-neutral-900 rounded-md"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-y-7 gap-x-3 w-full justify-items-center">
            {deals.map((deal) => (
              <a
                key={deal.id}
                href={deal.affiliate_url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col items-center text-center cursor-pointer transform active:scale-90 transition-transform duration-150"
              >
                {/* APP ICON TILE */}
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-b from-neutral-800 to-neutral-950 border border-neutral-700/60 group-hover:border-amber-400 rounded-2xl sm:rounded-3xl flex items-center justify-center p-2.5 shadow-xl shadow-black/60 group-hover:shadow-amber-500/20 transition-all">
                 
                  {/* BOGO CHIP BADGE */}
                  <span className="absolute -top-1.5 -right-1 text-[8px] font-black uppercase bg-amber-400 text-black px-1.5 py-0.5 rounded-full shadow-md z-10">
                    BOGO
                  </span>

                  {/* STORE LOGO / FALLBACK INITIAL */}
                  {deal.store_logo ? (
                    <img
                      src={deal.store_logo}
                      alt={`${deal.store_name} logo`}
                      className="max-h-10 max-w-10 sm:max-h-12 sm:max-w-12 object-contain filter drop-shadow"
                    />
                  ) : (
                    <span className="text-xl sm:text-2xl font-black text-amber-400">
                      {deal.store_name.charAt(0)}
                    </span>
                  )}
                </div>

                {/* STORE TITLE UNDER ICON */}
                <span className="text-[11px] font-bold text-neutral-200 group-hover:text-amber-300 mt-2 truncate max-w-[72px] tracking-tight">
                  {deal.store_name}
                </span>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* FOOTER METADATA BAR */}
      <div className="mt-auto pt-6">
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-3 text-center backdrop-blur-md">
          <p className="text-[10px] text-neutral-400 font-semibold">
            ⚡ Daily Ingestion Active • Direct Merchant Affiliate Redirects
          </p>
        </div>
      </div>
    </main>
  );
}
