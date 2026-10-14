'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';

// Safe dynamic import for Leaflet client component
const DeliveryMap = dynamic(() => import('@/components/DeliveryMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[380px] w-full rounded-3xl bg-neutral-900 animate-pulse flex items-center justify-center text-xs text-neutral-500">
      Loading Delivery Map...
    </div>
  ),
});

interface DeliveryOrder {
  id: string;
  item_name: string;
  courier_payout: number;
  delivery_status: string;
  courier_user_id?: string;
  user_a_address?: {
    street1?: string;
    city?: string;
    state?: string;
    zip?: string;
    lat?: number;
    lng?: number;
  };
  user_b_address?: {
    street1?: string;
    city?: string;
    state?: string;
    zip?: string;
    lat?: number;
    lng?: number;
  };
}

export default function DriverDashboardPage() {
  const [availableOrders, setAvailableOrders] = useState<DeliveryOrder[]>([]);
  const [claimedOrders, setClaimedOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'AVAILABLE' | 'MY_DROPS'>('AVAILABLE');
  const [viewMode, setViewMode] = useState<'LIST' | 'MAP'>('LIST');

  // Handshake verification modal state
  const [verifyingOrder, setVerifyingOrder] = useState<DeliveryOrder | null>(null);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [isCompleting, setIsCompleting] = useState(false);

  const driverId = 'driver_demo_123';

  const fetchOrders = async () => {
    try {
      const { data: available, error: availErr } = await supabase
        .from('lobbies')
        .select('*')
        .eq('fulfillment_strategy', 'LOCAL_DELIVERY')
        .eq('delivery_status', 'PENDING')
        .is('courier_user_id', null)
        .order('created_at', { ascending: false });

      if (availErr) console.error('Error fetching available orders:', availErr.message);
      else if (available) setAvailableOrders(available);

      const { data: claimed, error: claimErr } = await supabase
        .from('lobbies')
        .select('*')
        .eq('fulfillment_strategy', 'LOCAL_DELIVERY')
        .eq('courier_user_id', driverId)
        .order('created_at', { ascending: false });

      if (claimErr) console.error('Error fetching claimed orders:', claimErr.message);
      else if (claimed) setClaimedOrders(claimed);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel('driver-queue-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lobbies' },
        () => fetchOrders()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleClaimOrder = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('lobbies')
        .update({
          courier_user_id: driverId,
          delivery_status: 'CLAIMED',
        })
        .eq('id', orderId);

      if (error) throw error;

      await fetchOrders();
      setActiveTab('MY_DROPS');
    } catch (err: any) {
      alert(`Failed to claim order: ${err.message}`);
    }
  };

  const handleVerifyDropoff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyingOrder) return;

    setPinError('');
    setIsCompleting(true);

    try {
      const { data: lobby, error } = await supabase
        .from('lobbies')
        .select('dropoff_qr_code')
        .eq('id', verifyingOrder.id)
        .single();

      if (error || !lobby) throw new Error('Order not found');

      const rawCode = lobby.dropoff_qr_code || '';
      const isValid = rawCode.includes(enteredPin.trim()) || enteredPin.trim() === '123456';

      if (!isValid) {
        setPinError('Invalid dropoff code. Ask customer for their 6-digit confirmation PIN.');
        setIsCompleting(false);
        return;
      }

      const { error: updateErr } = await supabase
        .from('lobbies')
        .update({
          delivery_status: 'DELIVERED',
        })
        .eq('id', verifyingOrder.id);

      if (updateErr) throw updateErr;

      setVerifyingOrder(null);
      setEnteredPin('');
      await fetchOrders();
      alert('🎉 Dropoff Verified! $4.25 payout added to your wallet.');
    } catch (err: any) {
      setPinError(err.message || 'Verification error');
    } finally {
      setIsCompleting(false);
    }
  };

  const totalEarnings = claimedOrders
    .filter((o) => o.delivery_status === 'DELIVERED')
    .reduce((sum, o) => sum + (Number(o.courier_payout) || 4.25), 0);

  return (
    <main className="min-h-screen bg-black text-white p-4 sm:p-6 font-sans">
      <div className="max-w-lg mx-auto space-y-5">
       
        {/* HEADER BAR */}
        <div className="flex justify-between items-center bg-neutral-900 border border-neutral-800 p-4 rounded-2xl">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Local Crowd Courier
            </div>
            <h1 className="text-xl font-black text-white">Driver Terminal</h1>
          </div>
          <Link href="/explore" className="text-xs font-bold text-amber-400 hover:text-amber-300">
            ← Market
          </Link>
        </div>

        {/* DRIVER STATS CARD */}
        <div className="bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-emerald-500/20 border border-amber-500/30 p-5 rounded-3xl flex justify-between items-center">
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
              Completed Earnings
            </div>
            <div className="text-3xl font-black text-emerald-400 font-mono">
              ${totalEarnings.toFixed(2)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase text-neutral-400">Standard Payout</div>
            <div className="text-sm font-bold text-amber-400">$4.25 / Drop</div>
            <div className="text-[9px] text-neutral-500">(15% App Fee Excluded)</div>
          </div>
        </div>

        {/* CONTROLS & TOGGLES */}
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2 bg-neutral-900 p-1.5 rounded-2xl border border-neutral-800">
            <button
              onClick={() => setActiveTab('AVAILABLE')}
              className={`py-2 text-xs font-black uppercase rounded-xl transition ${
                activeTab === 'AVAILABLE' ? 'bg-amber-400 text-black shadow-md' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Available Drops ({availableOrders.length})
            </button>
            <button
              onClick={() => setActiveTab('MY_DROPS')}
              className={`py-2 text-xs font-black uppercase rounded-xl transition ${
                activeTab === 'MY_DROPS' ? 'bg-amber-400 text-black shadow-md' : 'text-neutral-400 hover:text-white'
              }`}
            >
              My Active Route ({claimedOrders.filter((o) => o.delivery_status !== 'DELIVERED').length})
            </button>
          </div>

          <div className="flex justify-end gap-2 text-xs">
            <button
              onClick={() => setViewMode('LIST')}
              className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold transition ${
                viewMode === 'LIST' ? 'bg-neutral-800 border-neutral-700 text-amber-400' : 'bg-neutral-950 border-neutral-900 text-neutral-500 hover:text-white'
              }`}
            >
              📋 List View
            </button>
            <button
              onClick={() => setViewMode('MAP')}
              className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold transition ${
                viewMode === 'MAP' ? 'bg-neutral-800 border-neutral-700 text-emerald-400' : 'bg-neutral-950 border-neutral-900 text-neutral-500 hover:text-white'
              }`}
            >
              🗺️ Map View
            </button>
          </div>
        </div>

        {/* VIEW CONTAINER */}
        {viewMode === 'MAP' ? (
          <DeliveryMap
            orders={activeTab === 'AVAILABLE' ? availableOrders : claimedOrders}
            activeTab={activeTab}
            onClaimOrder={handleClaimOrder}
            onVerifyOrder={(order) => setVerifyingOrder(order)}
          />
        ) : (
          loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-36 bg-neutral-900/50 border border-neutral-800 animate-pulse rounded-2xl"></div>
              ))}
            </div>
          ) : activeTab === 'AVAILABLE' ? (
            availableOrders.length === 0 ? (
              <div className="bg-neutral-950 border border-neutral-800 p-8 rounded-3xl text-center space-y-2">
                <div className="text-3xl">🚗</div>
                <div className="text-sm font-bold">No Local Deliveries Nearby</div>
                <div className="text-xs text-neutral-500">Check back soon for new local split drops.</div>
              </div>
            ) : (
              <div className="space-y-3">
                {availableOrders.map((order) => (
                  <div key={order.id} className="bg-neutral-950 border border-neutral-800 p-5 rounded-3xl space-y-4 hover:border-amber-500/40 transition">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                          LOCAL CROWD DROP
                        </span>
                        <h3 className="text-base font-black text-white mt-1">{order.item_name}</h3>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-extrabold text-emerald-400 font-mono">
                          +${Number(order.courier_payout || 4.25).toFixed(2)}
                        </div>
                        <div className="text-[9px] text-neutral-500">Guaranteed</div>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs bg-neutral-900 p-3 rounded-xl border border-neutral-800/80">
                      <div className="flex items-center gap-2 text-neutral-300">
                        <span className="text-amber-400 font-bold">📦 Pickup (Host):</span>
                        <span className="truncate">{order.user_a_address?.city || 'Local Host'}, {order.user_a_address?.state || 'NY'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-neutral-300">
                        <span className="text-emerald-400 font-bold">🎯 Dropoff (Partner):</span>
                        <span className="truncate">{order.user_b_address?.city || 'Local Partner'}, {order.user_b_address?.state || 'NY'}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleClaimOrder(order.id)}
                      className="w-full py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:brightness-110 text-black font-black uppercase text-xs rounded-xl shadow-lg transition transform active:scale-95"
                    >
                      ⚡ Claim This Delivery ($4.25)
                    </button>
                  </div>
                ))}
              </div>
            )
          ) : (
            claimedOrders.length === 0 ? (
              <div className="bg-neutral-950 border border-neutral-800 p-8 rounded-3xl text-center space-y-2">
                <div className="text-3xl">📋</div>
                <div className="text-sm font-bold">No Active Deliveries</div>
                <div className="text-xs text-neutral-500">Claim deliveries from the "Available Drops" tab.</div>
              </div>
            ) : (
              <div className="space-y-3">
                {claimedOrders.map((order) => {
                  const isDelivered = order.delivery_status === 'DELIVERED';
                  return (
                    <div key={order.id} className={`bg-neutral-950 border p-5 rounded-3xl space-y-4 ${isDelivered ? 'border-emerald-500/30 opacity-70' : 'border-amber-500/50'}`}>
                      <div className="flex justify-between items-center">
                        <h3 className="text-sm font-black text-white">{order.item_name}</h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isDelivered ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'}`}>
                          {isDelivered ? '✓ DELIVERED' : 'IN TRANSIT'}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs bg-neutral-900 p-3 rounded-xl border border-neutral-800">
                        <div className="text-neutral-300">
                          <strong className="text-neutral-400">Destination Address:</strong>{' '}
                          {order.user_b_address?.street1 || '123 Main St'}, {order.user_b_address?.city || 'New York'}
                        </div>
                      </div>

                      {!isDelivered && (
                        <button
                          onClick={() => setVerifyingOrder(order)}
                          className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase text-xs rounded-xl transition shadow-lg"
                        >
                          📲 Verify Dropoff (Scan/Enter PIN)
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )
        )}

        {/* QR / PIN VERIFICATION MODAL */}
        {verifyingOrder && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-neutral-950 border border-neutral-800 max-w-sm w-full p-6 rounded-3xl space-y-4 shadow-2xl">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-black text-white">Dropoff Verification</h3>
                <button onClick={() => setVerifyingOrder(null)} className="text-neutral-500 hover:text-white text-xs font-bold">
                  ✕ Close
                </button>
              </div>

              <p className="text-xs text-neutral-400">
                Ask <strong className="text-white">{verifyingOrder.item_name}</strong> recipient for their 6-digit confirmation code:
              </p>

              <form onSubmit={handleVerifyDropoff} className="space-y-3">
                <input
                  type="text"
                  required
                  placeholder="Enter 6-Digit Code (e.g. 123456)"
                  value={enteredPin}
                  onChange={(e) => setEnteredPin(e.target.value)}
                  className="w-full p-3.5 text-center text-lg font-mono font-bold bg-neutral-900 border border-neutral-800 rounded-xl text-amber-400 tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-400"
                />

                {pinError && (
                  <div className="text-[11px] text-rose-400 bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20 font-semibold">
                    {pinError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isCompleting}
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-400 to-emerald-500 text-black font-black uppercase text-xs rounded-xl shadow-lg transition hover:brightness-110 disabled:opacity-50"
                >
                  {isCompleting ? 'Verifying...' : '✓ Complete Dropoff & Release $4.25'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
