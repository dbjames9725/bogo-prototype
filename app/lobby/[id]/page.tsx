'use client';

import { useEffect, useState, use } from 'react';
import { supabase } from '@/lib/supabase';

export default function LobbyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: lobbyId } = use(params);
  const [lobby, setLobby] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 1. Initial fetch & Real-time Subscription Setup
  useEffect(() => {
    async function getLobby() {
      const { data, error } = await supabase
        .from('lobbies')
        .select('*')
        .eq('id', lobbyId)
        .single();

      if (!error && data) {
        setLobby(data);
      }
      setLoading(false);
    }

    getLobby();

    // 2. Subscribe to real-time updates for this specific lobby record
    const channel = supabase
      .channel(`lobby-${lobbyId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'lobbies',
          filter: `id=eq.${lobbyId}`,
        },
        (payload) => {
          console.log('Real-time lobby update received:', payload.new);
          setLobby(payload.new); // Instantly updates UI state when MATCHED or shipping label is generated
        }
      )
      .subscribe();

    // 3. Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [lobbyId]);

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading lobby details...</div>;
  }

  if (!lobby) {
    return <div className="text-center py-12 text-red-500">Lobby not found.</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-xl shadow-md border border-gray-100">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{lobby.item_name}</h1>
        <span
          className={`px-3 py-1 text-xs font-bold rounded-full ${
            lobby.status === 'MATCHED'
              ? 'bg-green-100 text-green-800 border border-green-300'
              : 'bg-yellow-100 text-yellow-800 border border-yellow-300'
          }`}
        >
          {lobby.status === 'MATCHED' ? '🎉 MATCH CONFIRMED' : '⏳ Awaiting Partner'}
        </span>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 space-y-2 mb-6 text-sm text-gray-700">
        <div className="flex justify-between">
          <span>Deal Type:</span>
          <span className="font-semibold text-gray-900">
            {lobby.deal_type === 'BOGO_50' ? 'Buy 1 Get 1 50% OFF' : 'Buy 1 Get 1 FREE'}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Item Retail Price:</span>
          <span className="font-semibold text-gray-900">${lobby.item_price?.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Host Share:</span>
          <span className="font-semibold text-blue-600">${lobby.user_a_share?.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Partner Share:</span>
          <span className="font-semibold text-green-600">${lobby.user_b_share?.toFixed(2)}</span>
        </div>
      </div>

      {/* MATCHED State */}
      {lobby.status === 'MATCHED' ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-5 text-center space-y-3">
          <h2 className="text-lg font-bold text-green-900">Match Completed & Captured!</h2>
          <p className="text-sm text-green-800">
            Both payment authorizations succeeded. You can download the return shipping label below:
          </p>
          {lobby.shipping_label_url && (
            <a
              href={lobby.shipping_label_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-5 rounded-lg shadow transition text-sm"
            >
              Download Shipping Label
            </a>
          )}
          {lobby.tracking_code && (
            <p className="text-xs text-gray-600">
              Tracking Code: <span className="font-mono font-semibold">{lobby.tracking_code}</span>
            </p>
          )}
        </div>
      ) : (
        /* PENDING State */
        <div className="border border-blue-100 bg-blue-50/50 rounded-lg p-5 text-center space-y-3">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mb-1"></div>
          <p className="text-sm text-blue-900 font-medium">
            Waiting for a partner to join and authorize payment...
          </p>
          <p className="text-xs text-gray-500">
            This page will automatically update the moment your match is confirmed!
          </p>
        </div>
      )}
    </div>
  );
}

