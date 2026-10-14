'use client';

import { useState } from 'react';

export default function NewCampaignPage() {
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState({
    shop_domain: 'bogo-test-sandbox.myshopify.com',
    title: '',
    buy_product_id: '',
    buy_quantity: 1,
    get_product_id: '',
    get_quantity: 1,
    discount_type: 'percentage',
    discount_value: 100,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusMessage(null);

    try {
      const endpoint = `${window.location.origin}/api/campaigns`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setStatusMessage({ type: 'success', text: `Campaign "${result.campaign?.title || formData.title}" saved successfully to Supabase!` });
        setFormData({
          shop_domain: 'bogo-test-sandbox.myshopify.com',
          title: '',
          buy_product_id: '',
          buy_quantity: 1,
          get_product_id: '',
          get_quantity: 1,
          discount_type: 'percentage',
          discount_value: 100,
        });
      } else {
        setStatusMessage({ type: 'error', text: result.error || 'Failed to save campaign.' });
      }
    } catch (err: any) {
      console.error('Submit Error:', err);
      setStatusMessage({ type: 'error', text: `Error: ${err.message || 'Check terminal logs.'}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-10 px-6 font-sans">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Create BOGO Campaign</h1>
        <p className="text-gray-600 mt-1">Configure automated Buy-One-Get-One discount rules for your Shopify store.</p>
      </div>

      {statusMessage && (
        <div
          className={`p-4 mb-6 rounded-md ${
            statusMessage.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 border rounded-xl shadow-sm">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Title</label>
          <input
            type="text"
            name="title"
            required
            placeholder="e.g., Summer Special: Buy T-Shirt, Get Cap Free"
            value={formData.title}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-black focus:outline-none text-black"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">1. Customer Buys</h2>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Trigger Product ID (Shopify GID)</label>
              <input
                type="text"
                name="buy_product_id"
                required
                placeholder="gid://shopify/Product/12345678"
                value={formData.buy_product_id}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none text-black"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Required Quantity</label>
              <input
                type="number"
                name="buy_quantity"
                min="1"
                required
                value={formData.buy_quantity}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none text-black"
              />
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">2. Customer Gets</h2>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Reward Product ID (Shopify GID)</label>
              <input
                type="text"
                name="get_product_id"
                required
                placeholder="gid://shopify/Product/87654321"
                value={formData.get_product_id}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none text-black"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Reward Quantity</label>
              <input
                type="number"
                name="get_quantity"
                min="1"
                required
                value={formData.get_quantity}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none text-black"
              />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Discount Type</label>
            <select
              name="discount_type"
              value={formData.discount_type}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none text-black"
            >
              <option value="percentage">Percentage Off</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Discount Amount (%)</label>
            <input
              type="number"
              name="discount_value"
              min="1"
              max="100"
              required
              value={formData.discount_value}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none text-black"
            />
            <span className="text-xs text-gray-500 mt-1 block">100 = Free (Standard BOGO), 50 = Buy 1 Get 1 at 50% Off</span>
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="bg-black hover:bg-gray-800 text-white font-medium px-6 py-2.5 rounded-lg text-sm transition disabled:opacity-50"
          >
            {loading ? 'Saving Campaign...' : 'Save BOGO Campaign'}
          </button>
        </div>
      </form>
    </div>
  );
}
