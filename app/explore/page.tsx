'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface Lobby {
  id: string;
  item_name: string;
  item_price: number;
  deal_type: string;
  status: string;
  created_at: string;
  host_avatar?: string;
  user_a_address?: {
    state?: string;
  };
}

const FEATURED_BRANDS = ['All', 'Nike', 'Ulta', 'Sephora', 'Amazon', 'Adidas'];

export default function ExploreDealsPage() {
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('All');

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

    // Real-time listener: Add new lobbies instantly or remove lobbies when matched
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

  // Filter lobbies by selected brand pill AND search input text
  const filteredLobbies = lobbies.filter((lobby) => {
    const matchesSearch = lobby.item_name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());

    const matchesBrand =
      selectedBrand === 'All' ||
      lobby.item_name.toLowerCase().includes(selectedBrand.toLowerCase());

    return matchesSearch && matchesBrand;
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
              Public BOGO Deal Board
            </h1>
            <p className="mt-1 text-sm text-neutral-400">
              Claim an active 50/50 split hold from buyers anywhere in the U.S.
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 px-5 py-3 text-xs font-black uppercase tracking-wider text-black shadow-lg transition hover:brightness-110 active:scale-95"
          >
            + Create New Lobby
          </Link>
        </div>

        {/* SEARCH BAR */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search deals by item name or store..."
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

        {/* BRAND & STORE FILTER PILLS */}
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
                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-amber-400 text-black shadow-lg shadow-amber-500/20'
                    : 'bg-neutral-900 text-neutral-400 border border-neutral-800 hover:border-neutral-700 hover:text-white'
                }`}
              >
                {brand === 'All' ? '🌐 All Stores' : brand}
              </button>
            );
          })}
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
            <div className="text-4xl">🛒</div>
            <h3 className="text-lg font-bold text-white">No Active Lobbies Found</h3>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto">
              {selectedBrand !== 'All'
                ? `No active BOGO splits found for ${selectedBrand}.`
                : searchQuery
                ? `No pending splits match "${searchQuery}".`
                : 'There are currently no open lobbies waiting for a partner.'}
            </p>
            <Link
              href="/"
              className="inline-block mt-2 text-xs font-bold text-amber-400 hover:underline"
            >
              Start the first lobby now →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredLobbies.map((lobby) => {
              const retail = Number(lobby.item_price) || 0;
              const split = (retail / 2).toFixed(2);
              const hostState = lobby.user_a_address?.state || 'US';

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
                      <span className="text-[10px] font-mono font-bold text-amber-400">
                        50% OFF SPLIT
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
                          Retail
                        </div>
                        <div className="text-sm font-semibold text-neutral-400 line-through">
                          ${retail.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase text-emerald-400">
                          Your Cost
                        </div>
                        <div className="text-lg font-black text-emerald-400">
                          ${split}
                        </div>
                      </div>
                    </div>
                  </div>

                  <Link
                    href={`/lobby/${lobby.id}`}
                    className="mt-6 block w-full rounded-xl bg-neutral-900 border border-neutral-700 py-3 text-center text-xs font-black uppercase tracking-wider text-white transition hover:bg-emerald-500 hover:border-emerald-400 hover:text-black"
                  >
                    Join & Lock In Split
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

