'use client';

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface DeliveryOrder {
  id: string;
  item_name: string;
  courier_payout: number;
  delivery_status: string;
  user_a_address?: {
    city?: string;
    state?: string;
    lat?: number;
    lng?: number;
  };
  user_b_address?: {
    city?: string;
    state?: string;
    lat?: number;
    lng?: number;
  };
}

interface DeliveryMapProps {
  orders: DeliveryOrder[];
  activeTab: 'AVAILABLE' | 'MY_DROPS';
  onClaimOrder: (id: string) => void;
  onVerifyOrder: (order: DeliveryOrder) => void;
}

const pickupIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-gold.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const dropoffIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const getCoords = (order: DeliveryOrder, type: 'PICKUP' | 'DROPOFF') => {
  if (type === 'PICKUP') {
    const lat = order.user_a_address?.lat || 40.7128 + (Math.random() * 0.04 - 0.02);
    const lng = order.user_a_address?.lng || -74.0060 + (Math.random() * 0.04 - 0.02);
    return [lat, lng] as [number, number];
  }
  const lat = order.user_b_address?.lat || 40.7306 + (Math.random() * 0.04 - 0.02);
  const lng = order.user_b_address?.lng || -73.9352 + (Math.random() * 0.04 - 0.02);
  return [lat, lng] as [number, number];
};

export default function DeliveryMap({ orders, activeTab, onClaimOrder, onVerifyOrder }: DeliveryMapProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="h-[380px] w-full rounded-3xl bg-neutral-900 animate-pulse flex items-center justify-center text-xs text-neutral-500">
        Loading Delivery Map...
      </div>
    );
  }

  return (
    <div className="h-[380px] w-full rounded-3xl overflow-hidden border border-neutral-800 bg-neutral-900 relative">
      <MapContainer center={[40.7128, -74.0060]} zoom={12} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        {orders.map((order) => {
          const pickupCoords = getCoords(order, 'PICKUP');
          const dropoffCoords = getCoords(order, 'DROPOFF');

          return (
            <React.Fragment key={order.id}>
              <Marker position={pickupCoords} icon={pickupIcon}>
                <Popup>
                  <div className="text-black text-xs space-y-1">
                    <strong className="block text-amber-600 font-extrabold uppercase">
                      📦 Pickup: {order.item_name}
                    </strong>
                    <div>{order.user_a_address?.city || 'Local Host'}, {order.user_a_address?.state || 'NY'}</div>
                    {activeTab === 'AVAILABLE' && (
                      <button
                        onClick={() => onClaimOrder(order.id)}
                        className="mt-2 w-full bg-amber-400 hover:bg-amber-500 text-black text-[10px] font-black uppercase py-1.5 px-2 rounded"
                      >
                        Claim Job ($4.25)
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>

              <Marker position={dropoffCoords} icon={dropoffIcon}>
                <Popup>
                  <div className="text-black text-xs space-y-1">
                    <strong className="block text-emerald-600 font-extrabold uppercase">
                      🎯 Dropoff Destination
                    </strong>
                    <div>{order.user_b_address?.city || 'Local Partner'}, {order.user_b_address?.state || 'NY'}</div>
                    {activeTab === 'MY_DROPS' && order.delivery_status !== 'DELIVERED' && (
                      <button
                        onClick={() => onVerifyOrder(order)}
                        className="mt-2 w-full bg-emerald-500 hover:bg-emerald-600 text-black text-[10px] font-black uppercase py-1.5 px-2 rounded"
                      >
                        Verify Dropoff
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          );
        })}
      </MapContainer>
      <div className="absolute bottom-3 left-3 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-neutral-800 text-[10px] text-neutral-300 z-[1000] space-x-2">
        <span>🟡 Gold = Pickup</span>
        <span>🟢 Green = Dropoff</span>
      </div>
    </div>
  );
}