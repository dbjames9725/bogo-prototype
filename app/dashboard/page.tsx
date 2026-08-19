'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface Lobby {
  id: string;
  item_name: string;
  item_price: number;
  deal_type: 'BOGO_FREE' | 'BOGO_50';
  user_a_share: number;
  user_b_share: number;
  status: 'PENDING' | 'MATCHED' | 'EXPIRED';
  created_at: string;
  shipping_label_url?: string;
  tracking_code?: string;
}

export default function DashboardPage() {
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'MATCHED'>('ALL');

  useEffect(() => {
    fetchLobbies();
  }, []);

  async function fetchLobbies() {
    setLoading(true);
    const { data, error } = await supabase
      .from('lobbies')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching lobbies:', error);
    } else {
      setLobbies(data || []);
    }
    setLoading(false);
  }

  const filteredLobbies = lobbies.filter((lobby) => {
    if (activeTab === 'PENDING') return lobby.status === 'PENDING';
    if (activeTab === 'MATCHED') return lobby.status === 'MATCHED';
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'MATCHED':
        return (
          <span className="bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-0.5 rounded border border-green-300">
            Matched
          </span>
        );
      case 'PENDING':
        return (
          <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-2.5 py-0.5 rounded border border-yellow-300">
            Awaiting Partner
          </span>
        );
      default:
        return (
          <span className="bg-gray-100 text-gray-800 text-xs font-semibold px-2.5 py-0.5 rounded border border-gray-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Host Dashboard</h1>
          <p className="text-gray-600 mt-1">Manage your active, pending, and completed BOGO split lobbies.</p>
        </div>
        <Link
          href="/"
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow transition text-center"
        >
          + Create New BOGO Lobby
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('ALL')}
          className={`py-2 px-4 font-medium text-sm border-b-2 transition ${
            activeTab === 'ALL'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          All Lobbies ({lobbies.length})
        </button>
        <button
          onClick={() => setActiveTab('PENDING')}
          className={`py-2 px-4 font-medium text-sm border-b-2 transition ${
            activeTab === 'PENDING'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Pending ({lobbies.filter((l) => l.status === 'PENDING').length})
        </button>
        <button
          onClick={() => setActiveTab('MATCHED')}
          className={`py-2 px-4 font-medium text-sm border-b-2 transition ${
            activeTab === 'MATCHED'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Matched ({lobbies.filter((l) => l.status === 'MATCHED').length})
        </button>
      </div>

      {/* Content State */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading your lobbies...</div>
      ) : filteredLobbies.length === 0 ? (
        <div className="bg-gray-50 rounded-xl p-8 text-center border border-gray-200">
          <p className="text-gray-600 text-lg">No lobbies found in this section.</p>
          <Link href="/" className="text-blue-600 hover:underline mt-2 inline-block font-medium">
            Start a new BOGO Split
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredLobbies.map((lobby) => (
            <div
              key={lobby.id}
              className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-3">
                  <h2 className="text-xl font-bold text-gray-900 truncate max-w-[240px]">
                    {lobby.item_name}
                  </h2>
                  {getStatusBadge(lobby.status)}
                </div>

                <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm text-gray-700 space-y-1">
                  <div className="flex justify-between">
                    <span>Deal Type:</span>
                    <span className="font-semibold text-gray-900">
                      {lobby.deal_type === 'BOGO_50' ? 'Buy 1 Get 1 50% OFF' : 'Buy 1 Get 1 FREE'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Item Price:</span>
                    <span className="font-semibold text-gray-900">${lobby.item_price.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Your Share (Host):</span>
                    <span className="font-semibold text-blue-600">${lobby.user_a_share.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100 flex flex-col gap-2">
                <Link
                  href={`/lobby/${lobby.id}`}
                  className="w-full text-center bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-lg transition text-sm"
                >
                  View Public Lobby
                </Link>

                {lobby.status === 'MATCHED' && lobby.shipping_label_url && (
                  <a
                    href={lobby.shipping_label_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full text-center bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition text-sm block"
                  >
                    Download Shipping Label
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
