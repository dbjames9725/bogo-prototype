'use client';

import { useState } from 'react';

export default function HomePage() {
  const [itemPrice, setItemPrice] = useState<number>(100);
  const [itemName, setItemName] = useState<string>('BOGO Offer Item');
  const [loading, setLoading] = useState(false);
  const [lobbyData, setLobbyData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleStartLobby() {
    if (!itemPrice || itemPrice <= 0) {
      setError('Please enter a valid item price.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/create-lobby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemPrice: Number(itemPrice),
          itemName: itemName || 'BOGO Offer Item'
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create lobby');
      }

      setLobbyData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <h1>BOGO Split Offer</h1>
      <p>Split any BOGO purchase 50/50 with a verified partner!</p>

      {!lobbyData ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Item Name:</label>
            <input
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g. Pro Runner Sneakers"
              style={{ width: '100%', padding: '10px', fontSize: '16px', borderRadius: '6px', border: '1px solid #ccc' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Total Retail Item Price ($):</label>
            <input
              type="number"
              min="1"
              step="0.01"
              value={itemPrice}
              onChange={(e) => setItemPrice(Number(e.target.value))}
              style={{ width: '100%', padding: '10px', fontSize: '16px', borderRadius: '6px', border: '1px solid #ccc' }}
            />
          </div>

          {/* Quick preset buttons */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {[50, 75, 100, 150, 200].map((price) => (
              <button
                key={price}
                type="button"
                onClick={() => setItemPrice(price)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '4px',
                  border: '1px solid #0070f3',
                  backgroundColor: itemPrice === price ? '#0070f3' : 'transparent',
                  color: itemPrice === price ? 'white' : '#0070f3',
                  cursor: 'pointer'
                }}
              >
                ${price}
              </button>
            ))}
          </div>

          <button
            onClick={handleStartLobby}
            disabled={loading}
            style={{
              marginTop: '1rem',
              padding: '12px 24px',
              fontSize: '16px',
              backgroundColor: '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Creating Lobby...' : `Start BOGO Lobby for $${itemPrice}`}
          </button>
          {error && <p style={{ color: 'red' }}>{error}</p>}
        </div>
      ) : (
        <div style={{ marginTop: '1.5rem', padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
          <h2>Lobby Created! 🎉</h2>
          <p><strong>Item:</strong> {lobbyData.itemName}</p>
          <p><strong>Retail Price:</strong> ${lobbyData.itemPrice}</p>
          <p><strong>Your 50% Split Charge:</strong> ${lobbyData.chargeAmount}</p>
          <p><strong>Share Link for Partner:</strong></p>
          <input
            readOnly
            value={`${typeof window !== 'undefined' ? window.location.origin : ''}/lobby/${lobbyData.lobbyId}`}
            style={{ width: '100%', padding: '8px', marginBottom: '1rem' }}
          />
        </div>
      )}
    </main>
  );
}
