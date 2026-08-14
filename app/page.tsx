'use client';

import { useState } from 'react';

export default function HomePage() {
  const [loading, setLoading] = useState(false);
  const [lobbyData, setLobbyData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleStartLobby() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/create-lobby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemPrice: 100 }),
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
      <p>Split a $100 purchase with a partner!</p>

      {!lobbyData ? (
        <div>
          <button
            onClick={handleStartLobby}
            disabled={loading}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              backgroundColor: '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Creating Lobby...' : 'Start a BOGO Split Lobby'}
          </button>
          {error && <p style={{ color: 'red', marginTop: '1rem' }}>{error}</p>}
        </div>
      ) : (
        <div style={{ marginTop: '1.5rem', padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
          <h2>Lobby Created! 🎉</h2>
          <p><strong>Lobby ID:</strong> {lobbyData.lobbyId}</p>
          <p><strong>Your Charge:</strong> ${lobbyData.chargeAmount}</p>
          <p><strong>Share Link:</strong></p>
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

