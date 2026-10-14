'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import GroupBulkMeter from '@/components/GroupBulkMeter';
import { supabase } from '@/lib/supabase';

interface Lobby {
  id: string;
  item_name: string;
  item_price: number;
  deal_type?: 'BOGO' | 'BULK_SPLIT' | string;
  total_units?: number;
  offered_units?: number;
  status: string;
  created_at: string;
  host_avatar?: string;
  original_url?: string;
  user_a_address?: {
    state?: string;
  };
}

const FEATURED_BRANDS = ['All', 'Costco', 'Nike', 'Ulta', 'Sephora', 'Amazon', 'Adidas'];

export default function ExploreDealsPage() {
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [dealTypeFilter, setDealTypeFilter] = useState<'ALL' | 'BOGO' | 'BULK_SPLIT'>('ALL');

  const fetchLobbies = async () => {
    try {
      const { data, error } = await supabase
        .from('lobbies')
        .select('*')
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching lobbies:', error.message);
      } else if (data) {
        setLobbies(data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLobbies();

    const channel = supabase
      .channel('explore-lobbies-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lobbies',
        },
        () => {
          fetchLobbies();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredLobbies = lobbies.filter((lobby) => {
    const matchesSearch = lobby.item_name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());

    const matchesBrand =
      selectedBrand === 'All' ||
      lobby.item_name.toLowerCase().includes(selectedBrand.toLowerCase());

    const lobbyType = lobby.deal_type || 'BOGO';
    const matchesType =
      dealTypeFilter === 'ALL' ||
      (dealTypeFilter === 'BOGO' && lobbyType === 'BOGO') ||
      (dealTypeFilter === 'BULK_SPLIT' && lobbyType === 'BULK_SPLIT');

    return matchesSearch && matchesBrand && matchesType;
  });

  return (
    <div className="min-h-[100dvh] bg-black text-white p-4 sm:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
       
        {/* HEADER SECTION */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400"></span>
              Live Nationwide Pool
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
              Public BOGO & Bulk Split Board
            </h1>
            <p className="mt-1 text-sm text-neutral-400">
              Claim 50/50 BOGO deals or split multi-pack bulk orders with shoppers anywhere in the U.S.
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 px-5 py-3 text-xs font-black uppercase tracking-wider text-black shadow-lg transition hover:brightness-110 active:scale-95"
          >
            + Post Deal or Bulk Split
          </Link>
        </div>

        {/* SEARCH BAR */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search deals or bulk items by name or store (e.g. Costco 4-Pack, Nike)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl border border-neutral-800 bg-neutral-900 p-4 pl-12 text-sm text-white placeholder-neutral-500 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
          <svg
            className="absolute left-4 top-4 h-5 w-5 text-neutral-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        {/* CATEGORY & STORE FILTER TABS */}
        <div className="space-y-3">
          {/* DEAL TYPE TOGGLES */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setDealTypeFilter('ALL')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                dealTypeFilter === 'ALL'
                  ? 'bg-neutral-800 text-white border border-neutral-700'
                  : 'bg-neutral-950 text-neutral-400 border border-neutral-900 hover:text-white'
              }`}
            >
              All Open Deals
            </button>
            <button
              onClick={() => setDealTypeFilter('BOGO')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                dealTypeFilter === 'BOGO'
                  ? 'bg-amber-400/20 text-amber-300 border border-amber-500/40'
                  : 'bg-neutral-950 text-neutral-400 border border-neutral-900 hover:text-white'
              }`}
            >
              BOGO Deals (50% Off)
            </button>
            <button
              onClick={() => setDealTypeFilter('BULK_SPLIT')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                dealTypeFilter === 'BULK_SPLIT'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-neutral-950 text-neutral-400 border border-neutral-900 hover:text-white'
              }`}
            >
              Bulk & Multi-Pack Splits
            </button>
          </div>

          {/* STORE PILLS */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 mr-1 shrink-0">
              Stores:
            </span>
            {FEATURED_BRANDS.map((brand) => {
              const isActive = selectedBrand === brand;
              return (
                <button
                  key={brand}
                  onClick={() => setSelectedBrand(brand)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-amber-400 text-black shadow-md shadow-amber-500/20 font-bold'
                      : 'bg-neutral-900 text-neutral-400 border border-neutral-800 hover:border-neutral-700 hover:text-white'
                  }`}
                >
                  {brand === 'All' ? 'All Stores' : brand}
                </button>
              );
            })}
          </div>
        </div>

        {/* LOBBIES GRID */}
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-48 animate-pulse rounded-3xl border border-neutral-800 bg-neutral-900/50 p-6"
              ></div>
            ))}
          </div>
        ) : filteredLobbies.length === 0 ? (
          <div className="rounded-3xl border border-neutral-800 bg-neutral-950 p-12 text-center space-y-3">
            <h3 className="text-lg font-bold text-white">No Active Lobbies Found</h3>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto">
              {selectedBrand !== 'All'
                ? `No active splits found for ${selectedBrand}.`
                : searchQuery
                ? `No pending splits match "${searchQuery}".`
                : 'There are currently no open lobbies waiting for a partner.'}
            </p>
            <Link
              href="/"
              className="inline-block mt-2 text-xs font-bold text-amber-400 hover:underline"
            >
              Post the first deal or bulk split now →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredLobbies.map((lobby) => {
              const retail = Number(lobby.item_price) || 0;
              const isBulk = lobby.deal_type === 'BULK_SPLIT';
              const totalUnits = lobby.total_units || 2;
              const offeredUnits = lobby.offered_units || 1;
              const unitPrice = (retail / totalUnits).toFixed(2);
              const partnerShare = (Number(unitPrice) * offeredUnits).toFixed(2);
              const hostState = lobby.user_a_address?.state || 'US';

              const storeDealUrl =
                lobby.original_url ||
                `https://www.google.com/search?q=${encodeURIComponent(lobby.item_name)}`;

              return (
                <div
                  key={lobby.id}
                  className="group relative flex flex-col justify-between rounded-3xl border border-neutral-800 bg-neutral-950 p-6 shadow-xl transition hover:border-amber-500/50"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-neutral-800/80 pb-3">
                      <span className="rounded-full border border-neutral-700 bg-neutral-900 px-2.5 py-0.5 text-[10px] font-bold text-neutral-400">
                        Host in {hostState}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                          isBulk
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {isBulk ? `BULK SPLIT (${offeredUnits} of ${totalUnits})` : '50% OFF BOGO'}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-lg font-black text-white group-hover:text-amber-400 transition">
                        {lobby.item_name}
                      </h3>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        Lobby #{lobby.id.slice(0, 8)}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 rounded-2xl border border-neutral-800/80 bg-neutral-900 p-3 text-center">
                      <div>
                        <div className="text-[10px] font-bold uppercase text-neutral-500">
                          {isBulk ? 'Total Bundle' : 'Retail Price'}
                        </div>
                        <div className="text-sm font-semibold text-neutral-400 line-through">
                          ${retail.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase text-emerald-400">
                          {isBulk ? `Cost (${offeredUnits} Units)` : 'Your Split Share'}
                        </div>
                        <div className="text-lg font-black text-emerald-400">
                          ${partnerShare}
                        </div>
                      </div>
                    </div>

                    {/* BULK METER PROGRESS BAR */}
                    {isBulk && (
                      <div className="mt-3">
                        <GroupBulkMeter
                          totalUnits={totalUnits}
                          offeredUnits={offeredUnits}
                          unitPrice={Number(unitPrice)}
                          compact={true}
                        />
                      </div>
                    )}
                  </div>

                  {/* DUAL ACTION BUTTONS */}
                  <div className="mt-6 flex items-center gap-2">
                    <a
                      href={storeDealUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-3 px-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-amber-400 text-center text-xs font-bold transition flex items-center justify-center gap-1"
                      title="Inspect original item on retailer store page"
                    >
                      <span>🛍️ Store Deal</span>
                      <span className="text-[10px]">↗</span>
                    </a>

                    <Link
                      href={`/lobby/${lobby.id}`}
                      className="flex-1 py-3 px-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-black text-center text-xs font-black uppercase tracking-wider transition shadow-md"
                    >
                      ⚡ Join Split
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
