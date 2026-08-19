'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function LobbyClientView({ lobbyId }: { lobbyId: string }) {
  const [lobby, setLobby] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Get full URL for sharing
  const shareableUrl = typeof window !== 'undefined' ? `${window.location.origin}/lobby/${lobbyId}` : '';

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

    // Real-time listener for partner checkout
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
          console.log('Real-time update:', payload.new);
          setLobby(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [lobbyId]);

  const copyToClipboard = () => {
    if (shareableUrl) {
      navigator.clipboard.writeText(shareableUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading lobby details...</div>;
  }

  if (!lobby) {
    return <div className="text-center py-12 text-red-500">Lobby not found.</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 bg-white rounded-2xl shadow-sm border border-gray-200 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b border-gray-100">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{lobby.item_name}</h1>
          <p className="text-xs text-gray-500 mt-0.5">Lobby ID: <span className="font-mono">{lobbyId}</span></p>
        </div>
        <span
          className={`px-3 py-1 text-xs font-bold rounded-full ${
            lobby.status === 'MATCHED'
              ? 'bg-green-100 text-green-800 border border-green-300'
              : 'bg-amber-100 text-amber-800 border border-amber-300'
          }`}
        >
          {lobby.status === 'MATCHED' ? '🎉 MATCH CONFIRMED' : '⏳ Awaiting Partner'}
        </span>
      </div>

      {/* Cost Breakdown */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm text-gray-700">
        <div className="flex justify-between">
          <span>Deal Type:</span>
          <span className="font-semibold text-gray-900">
            {lobby.deal_type === 'BOGO_50' ? 'Buy 1 Get 1 50% OFF' : 'Buy 1 Get 1 FREE'}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Total Price (with Tax):</span>
          <span className="font-semibold text-gray-900">${lobby.item_price?.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Host Share (User A):</span>
          <span className="font-semibold text-blue-600">${lobby.user_a_share?.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Partner Share (User B):</span>
          <span className="font-semibold text-emerald-600">${lobby.user_b_share?.toFixed(2)}</span>
        </div>
      </div>

      {/* PENDING State: Invite Link Box */}
      {lobby.status !== 'MATCHED' && (
        <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 text-white rounded-xl">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-blue-950 text-base">Share Partner Invite Link</h3>
              <p className="text-xs text-blue-700">Send this link to a partner so they can join and pay their half.</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              readOnly
              value={shareableUrl}
              className="w-full bg-white border border-blue-200 rounded-xl px-3 py-2.5 text-xs text-gray-700 font-mono focus:outline-none"
            />
            <button
              type="button"
              onClick={copyToClipboard}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition shadow-sm whitespace-nowrap flex items-center justify-center gap-1.5"
            >
              {copied ? '✓ Link Copied!' : 'Copy Invite Link'}
            </button>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <a
              href={`sms:?body=${encodeURIComponent(`Hey! Let's split "${lobby.item_name}" on BOGO Split for $${lobby.user_b_share?.toFixed(2)}: ${shareableUrl}`)}`}
              className="text-xs font-semibold text-blue-700 hover:underline flex items-center gap-1"
            >
              📱 Share via Text / SMS
            </a>
            <span className="text-blue-300">•</span>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Hey! Let's split "${lobby.item_name}" on BOGO Split for $${lobby.user_b_share?.toFixed(2)}: ${shareableUrl}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-emerald-700 hover:underline flex items-center gap-1"
            >
              💬 WhatsApp
            </a>
          </div>

          <div className="pt-3 border-t border-blue-100 flex items-center justify-center gap-2 text-xs text-blue-800">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
            <span>Waiting for partner to open link and complete checkout...</span>
          </div>
        </div>
      )}

      {/* MATCHED State */}
      {lobby.status === 'MATCHED' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-4">
          <div className="text-3xl">🎉</div>
          <h2 className="text-xl font-bold text-emerald-950">Match Confirmed & Payment Captured!</h2>
          <p className="text-sm text-emerald-800">
            Both payment authorizations succeeded. You can download the return shipping label below:
          </p>
          {lobby.shipping_label_url && (
            <a
              href={lobby.shipping_label_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-xl shadow transition text-sm"
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
      )}
    </div>
  );
}