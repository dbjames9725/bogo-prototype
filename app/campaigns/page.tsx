'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Campaign {
  id: string;
  title: string;
  buy_product_id: string;
  buy_quantity: number;
  get_product_id: string;
  get_quantity: number;
  discount_type: string;
  discount_value: number;
  status: string;
  created_at: string;
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/campaigns', {
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });
      const data = await res.json();

      if (data.success) {
        setCampaigns(data.campaigns || []);
      } else {
        setError(data.error || 'Failed to load campaigns.');
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching campaigns.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this BOGO campaign?')) return;

    try {
      const res = await fetch(`/api/campaigns?id=${id}`, {
        method: 'DELETE',
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });
      const data = await res.json();

      if (data.success) {
        setCampaigns((prev) => prev.filter((c) => c.id !== id));
      } else {
        alert(data.error || 'Failed to delete campaign.');
      }
    } catch (err: any) {
      alert('Error deleting campaign.');
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  return (
    <div className="max-w-5xl mx-auto py-10 px-6 font-sans">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">BOGO Campaigns</h1>
          <p className="text-gray-600 mt-1">Manage active discount rules for your Shopify store.</p>
        </div>
        <Link
          href="/campaigns/new"
          className="bg-black hover:bg-gray-800 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition"
        >
          + Create New Campaign
        </Link>
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading campaigns from Supabase...</p>}
      {error && <div className="p-4 bg-red-50 text-red-800 border border-red-200 rounded-md mb-6">{error}</div>}

      {!loading && !error && campaigns.length === 0 && (
        <div className="bg-white p-8 text-center border rounded-xl shadow-sm">
          <p className="text-gray-500 mb-4">No active BOGO campaigns found.</p>
          <Link href="/campaigns/new" className="text-sm font-semibold text-black underline">
            Create your first campaign
          </Link>
        </div>
      )}

      {!loading && campaigns.length > 0 && (
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm text-gray-700">
            <thead className="bg-gray-50 border-b text-xs uppercase text-gray-500 font-medium">
              <tr>
                <th className="px-6 py-4">Title</th>
                <th className="px-6 py-4">Trigger Product (Buy)</th>
                <th className="px-6 py-4">Reward Product (Get)</th>
                <th className="px-6 py-4">Discount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {campaigns.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-semibold text-gray-900">{c.title}</td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{c.buy_product_id}</span>
                    <span className="text-xs text-gray-500 block mt-1">Qty: {c.buy_quantity}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{c.get_product_id}</span>
                    <span className="text-xs text-gray-500 block mt-1">Qty: {c.get_quantity}</span>
                  </td>
                  <td className="px-6 py-4 font-medium text-green-700">{c.discount_value}% OFF</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {c.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="text-red-600 hover:text-red-800 font-medium text-xs transition"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
