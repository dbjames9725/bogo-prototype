'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface StoreDeal {
  id: string;
  store_name: string;
  store_logo: string;
  deal_title: string;
  affiliate_url: string;
  badge?: string;
}

export default function FeaturedStoreDeals() {
  const [offers, setOffers] = useState<StoreDeal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStoreDeals = async () => {
      const { data, error } = await supabase
        .from('store_deals')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setOffers(data);
      }
      setLoading(false);
    };

    fetchStoreDeals();
  }, []);

  if (loading) {
    return (
      <div className="w-full h-32 animate-pulse bg-neutral-900/50 rounded-2xl border border-neutral-800" />
    );
  }

  if (offers.length === 0) return null;

  return (
    <div className="w-full space-y-3">
      <div className="flex justify-between items-center px-1">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse"></span>
          <h3 className="text-xs font-black uppercase text-amber-400 tracking-wider">
            Verified Retail BOGO Offers
          </h3>
        </div>
        <span className="text-[10px] font-bold text-neutral-500 bg-neutral-900 border border-neutral-800 px-2 py-1 rounded-lg">
          Live Offers
        </span>
      </div>

      {/* SCROLLABLE STORE OFFERS RIBBON */}
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
        {offers.map((offer) => (
          <div
            key={offer.id}
            className="flex-none w-64 bg-neutral-950 border border-neutral-800 hover:border-amber-400/50 rounded-2xl p-4 shadow-xl transition-all duration-200 group flex flex-col justify-between space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl bg-neutral-900 p-2 rounded-xl border border-neutral-800">
                  {offer.store_logo.startsWith('http') ? (
                    <img src={offer.store_logo} alt={offer.store_name} className="h-6 w-6 object-contain" />
                  ) : (
                    offer.store_logo
                  )}
                </span>
                <span className="text-xs font-bold text-white group-hover:text-amber-400 transition">
                  {offer.store_name}
                </span>
              </div>
              {offer.badge && (
                <span className="text-[9px] font-black uppercase bg-amber-400/10 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-full">
                  {offer.badge}
                </span>
              )}
            </div>

            <p className="text-xs font-extrabold text-neutral-200 line-clamp-2">
              {offer.deal_title}
            </p>

            <div className="flex items-center gap-2 pt-1">
              {/* STORE LINK WITH PASSIVE AFFILIATE TRACKING */}
              <a
                href={offer.affiliate_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-amber-400 text-center text-[10px] font-bold transition flex items-center justify-center gap-1"
              >
                <span>Store Deal</span>
                <span>↗</span>
              </a>

              {/* ACTION: INSTANTLY POST OR START A SPLIT LOBBY */}
              <a
                href={`/?item_name=${encodeURIComponent(
                  `${offer.store_name} -${offer.deal_title}`
                )}&url=${encodeURIComponent(offer.affiliate_url)}`}
                className="flex-1 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-center text-[10px] font-black uppercase tracking-wider transition shadow"
              >
                ⚡ Split Deal
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
