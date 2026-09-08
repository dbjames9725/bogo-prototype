document.addEventListener('DOMContentLoaded', () => {
  const lobbiesContainer = document.getElementById('lobbiesContainer');
  const refreshBtn = document.getElementById('refreshBtn');
  const createCustomLobbyBtn = document.getElementById('createCustomLobbyBtn');

  const BASE_URL = 'https://bogo-prototype-wheat.vercel.app';

  async function fetchActiveLobbies() {
    lobbiesContainer.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <span>Fetching live BOGO deals...</span>
      </div>
    `;

    try {
      // Fetch open lobbies from backend
      const res = await fetch(`${BASE_URL}/api/list-lobbies`);
      const data = await res.json();

      if (!res.ok || !data.lobbies || data.lobbies.length === 0) {
        lobbiesContainer.innerHTML = `
          <div class="empty-state">
            <span>🤝 No active lobbies waiting for a partner right now.</span>
            <span>Start a deal from any shopping page!</span>
          </div>
        `;
        return;
      }

      renderLobbies(data.lobbies);
    } catch (err) {
      console.error('Error fetching lobbies:', err);
      lobbiesContainer.innerHTML = `
        <div class="empty-state" style="color: #f87171;">
          <span>⚠️ Unable to connect to BOGO Split.</span>
        </div>
      `;
    }
  }

  function renderLobbies(lobbies) {
    lobbiesContainer.innerHTML = '';

    lobbies.forEach((lobby) => {
      const price = Number(lobby.item_price) || 0;
      const isBogo50 = lobby.deal_type === 'BOGO_50';
      const bogoTotal = isBogo50 ? price * 1.5 : price;
      const share = bogoTotal / 2;

      const card = document.createElement('div');
      card.className = 'lobby-card';
      card.innerHTML = `
        <div class="lobby-card-header">
          <div class="item-name" title="${lobby.item_name}">${lobby.item_name}</div>
          <span class="deal-type-badge">${isBogo50 ? 'BOGO 50%' : 'BOGO FREE'}</span>
        </div>
        <div class="price-math-row">
          <span>Retail: $${price.toFixed(2)}</span>
          <span class="user-share">Split Share: $${share.toFixed(2)}</span>
        </div>
        <button class="join-btn" data-lobby-id="${lobby.id}">
          🚀 Join Split Deal
        </button>
      `;

      card.querySelector('.join-btn').addEventListener('click', (e) => {
        const lobbyId = e.target.getAttribute('data-lobby-id');
        window.open(`${BASE_URL}/lobby/${lobbyId}`, '_blank');
      });

      lobbiesContainer.appendChild(card);
    });
  }

  refreshBtn.addEventListener('click', fetchActiveLobbies);

  createCustomLobbyBtn.addEventListener('click', () => {
    window.open(BASE_URL, '_blank');
  });

  // Initial Fetch
  fetchActiveLobbies();
});
