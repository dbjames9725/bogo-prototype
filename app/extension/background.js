const BASE_URL = 'https://bogo-prototype-wheat.vercel.app';

// 1. Cross-Origin Message Listener (Receives payload from content.js)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'CREATE_LOBBY_FROM_DOM') {
    fetch(`${BASE_URL}/api/create-lobby`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemName: request.payload.itemName,
        itemPrice: request.payload.itemPrice,
        dealType: request.payload.dealType || 'BOGO_FREE',
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.lobbyId) {
          // Track this newly created lobby in Extension Local Storage for notification polling
          trackHostedLobby(data.lobbyId);
        }
        sendResponse({ success: true, lobbyId: data.lobbyId });
      })
      .catch((err) => sendResponse({ success: false, error: err.message }));

    return true; // Keep async response channel open
  }
});

// 2. Track Hosted Lobbies in Extension Storage
function trackHostedLobby(lobbyId) {
  chrome.storage.local.get(['hostedLobbies'], (result) => {
    const hosted = result.hostedLobbies || [];
    if (!hosted.includes(lobbyId)) {
      hosted.push(lobbyId);
      chrome.storage.local.set({ hostedLobbies: hosted });
    }
  });
}

// 3. Notification Polling Engine (Runs in Service Worker)
async function checkLobbyMatches() {
  chrome.storage.local.get(['hostedLobbies', 'notifiedLobbies'], async (result) => {
    const hostedLobbies = result.hostedLobbies || [];
    const notifiedLobbies = result.notifiedLobbies || [];

    if (hostedLobbies.length === 0) return;

    for (const lobbyId of hostedLobbies) {
      // Skip if notification was already sent for this lobby
      if (notifiedLobbies.includes(lobbyId)) continue;

      try {
        const res = await fetch(`${BASE_URL}/api/check-lobby-status?lobbyId=${lobbyId}`);
        if (!res.ok) continue;

        const data = await res.json();

        // Trigger notification if a partner has joined & authorized their hold
        if (data.hasPartnerJoined || data.status === 'MATCHED') {
          showMatchNotification(data.itemName || 'Your BOGO Item', lobbyId);

          // Mark as notified to prevent duplicate popups
          notifiedLobbies.push(lobbyId);
          chrome.storage.local.set({ notifiedLobbies });
        }
      } catch (err) {
        console.error('Lobby status check failed:', err);
      }
    }
  });
}

// 4. Trigger Chrome Desktop Notification
function showMatchNotification(itemName, lobbyId) {
  chrome.notifications.create(
    `bogo_match_${lobbyId}`,
    {
      type: 'basic',
      iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      title: '🎉 BOGO Deal Partner Found!',
      message: `A shopper joined your split for "${itemName}". Click to view details and confirm!`,
      priority: 2,
    }
  );
}

// 5. Notification Click Handler (Opens the matched lobby page)
chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId.startsWith('bogo_match_')) {
    const lobbyId = notificationId.replace('bogo_match_', '');
    chrome.tabs.create({ url: `${BASE_URL}/lobby/${lobbyId}` });
  }
});

// 6. Setup Alarm Poller (Runs every ~12 seconds)
chrome.alarms.create('bogoLobbyPoller', { periodInMinutes: 0.2 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'bogoLobbyPoller') {
    checkLobbyMatches();
  }
});
