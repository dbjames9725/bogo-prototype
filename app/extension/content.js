(function () {
  if (window.hasBogoBuddyInjected) return;

  // 1. ADVANCED BOGO & BOGO 50% OFF DETECTION ENGINE
  function detectBogoDeal() {
    const bogo50Keywords = [
      'buy 1 get 1 50%',
      'buy 1, get 1 50%',
      'buy one get one 50%',
      'buy 1 get 1 half off',
      'buy 1 get 1 50% off',
      'bogo 50%',
      'bogo 50',
      '50% off second'
    ];

    const bogoFreeKeywords = [
      'buy 1 get 1 free',
      'buy one get one free',
      'buy 1 get 1',
      'buy one get one',
      'bogo free',
      'bogo',
      '2 for 1',
      'two for one',
      'buy 1, get 1'
    ];

    // Read full page text
    const pageText = document.body ? document.body.innerText.toLowerCase() : '';

    // Read high-priority promo banners and badge elements
    const promoElements = Array.from(
      document.querySelectorAll('.promo, .banner, .badge, .deal, [class*="promo"], [class*="deal"], [id*="promo"]')
    );
    const promoText = promoElements.map((el) => el.innerText.toLowerCase()).join(' ');

    const combinedText = `${pageText} ${promoText}`;

    // Priority Check 1: Check for BOGO 50% Off
    const isBogo50 = bogo50Keywords.some((keyword) => combinedText.includes(keyword));
    if (isBogo50) {
      return { active: true, dealType: 'BOGO_50' };
    }

    // Priority Check 2: Check for BOGO Free
    const isBogoFree = bogoFreeKeywords.some((keyword) => combinedText.includes(keyword));
    if (isBogoFree) {
      return { active: true, dealType: 'BOGO_FREE' };
    }

    return { active: false, dealType: null };
  }

  const dealDetection = detectBogoDeal();

  // STOP EXECUTION: Hide overlay if no BOGO deal keyword is present on page
  if (!dealDetection.active) {
    return;
  }

  window.hasBogoBuddyInjected = true;
  const activeDealType = dealDetection.dealType; // 'BOGO_FREE' or 'BOGO_50'

  // 2. SITE-SPECIFIC & UNIVERSAL SCRAPING ENGINE
  function getProductDetails() {
    const host = window.location.hostname.toLowerCase();

    let title = '';
    let price = 0;

    // --- SITE-SPECIFIC DOM SELECTORS ---
    if (host.includes('amazon.')) {
      title = document.querySelector('#productTitle')?.innerText;

      const whole = document.querySelector('.a-price-whole')?.innerText?.replace(/[^0-9]/g, '');
      const fraction = document.querySelector('.a-price-fraction')?.innerText?.replace(/[^0-9]/g, '');
      if (whole) {
        price = parseFloat(`${whole}.${fraction || '00'}`);
      } else {
        const offscreenPrice = document.querySelector('.a-price .a-offscreen')?.innerText;
        if (offscreenPrice) price = parsePriceString(offscreenPrice);
      }
    } else if (host.includes('nike.')) {
      title = document.querySelector('#pdp_product_title, h1[data-test="product-title"]')?.innerText;
      const priceEl = document.querySelector('[data-test="product-price"], .product-price');
      if (priceEl) price = parsePriceString(priceEl.innerText);
    } else if (host.includes('target.')) {
      title = document.querySelector('h1[data-test="product-title"]')?.innerText;
      const priceEl = document.querySelector('[data-test="product-price"]');
      if (priceEl) price = parsePriceString(priceEl.innerText);
    } else if (host.includes('walmart.')) {
      title = document.querySelector('h1[itemprop="name"]')?.innerText;
      const priceEl = document.querySelector('[itemprop="price"], [data-seo-id="hero-price"]');
      if (priceEl) price = parsePriceString(priceEl.innerText);
    }

    // --- FALLBACK 1: JSON-LD Structured Data (Shopify, WooCommerce) ---
    if (!title || !price) {
      const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
      jsonLdScripts.forEach((script) => {
        try {
          const data = JSON.parse(script.textContent);
          const product =
            data['@type'] === 'Product'
              ? data
              : data['@graph']?.find((item) => item['@type'] === 'Product');

          if (product) {
            if (!title && product.name) title = product.name;
            const offers = product.offers;
            const offerObj = Array.isArray(offers) ? offers[0] : offers;
            if (!price && offerObj?.price) {
              price = parseFloat(offerObj.price);
            }
          }
        } catch (e) {
          // Ignore invalid JSON-LD script tags
        }
      });
    }

    // --- FALLBACK 2: OpenGraph Metadata & Standard HTML Tags ---
    if (!title) {
      const ogTitle = document.querySelector('meta[property="og:title"]')?.content;
      const h1Text = document.querySelector('h1')?.innerText;
      title = ogTitle || h1Text || document.title || 'BOGO Split Item';
    }

    if (!price) {
      const ogPrice = document.querySelector('meta[property="og:price:amount"]')?.content;
      if (ogPrice) {
        price = parseFloat(ogPrice);
      } else {
        // --- FALLBACK 3: Regex Body Scan ---
        const match = document.body.innerText.match(/\$(\d+(?:\.\d{2})?)/);
        if (match && match[1]) {
          price = parseFloat(match[1]);
        }
      }
    }

    return {
      title: title.trim().replace(/\s+/g, ' '),
      price: price > 0 ? price : 100.0,
    };
  }

  function parsePriceString(str) {
    if (!str) return 0;
    const match = str.match(/\d+(?:\.\d{2})?/);
    return match ? parseFloat(match[0]) : 0;
  }

  const { title, price } = getProductDetails();

  // --- DYNAMIC MATH CALCULATION BASED ON DEAL TYPE ---
  // BOGO Free: Total = 1 * Price | Per person share = 0.5 * Price
  // BOGO 50%: Total = 1.5 * Price | Per person share = 0.75 * Price
  const isBogo50 = activeDealType === 'BOGO_50';
  const totalDealCost = isBogo50 ? price * 1.5 : price;
  const userShare = totalDealCost / 2;

  const pillLabel = isBogo50 ? '⚡ BOGO 50% OFF DETECTED' : '⚡ BOGO FREE DETECTED';
  const dealBadgeText = isBogo50 ? 'Save 25% Per Item' : 'Save 50% Per Item';

  // 3. SHADOW DOM CONTAINER ISOLATION
  const hostDiv = document.createElement('div');
  hostDiv.id = 'bogo-buddy-extension-root';
  document.body.appendChild(hostDiv);

  const shadow = hostDiv.attachShadow({ mode: 'open' });

  // 4. SHADOW DOM STYLES
  const style = document.createElement('style');
  style.textContent = `
    .bogo-floating-badge {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      background: #0a0a0a;
      border: 1px solid #262626;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
      border-radius: 20px;
      padding: 16px;
      width: 320px;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #ffffff;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .bogo-floating-badge:hover {
      border-color: #3b82f6;
    }

    .bogo-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    .bogo-pill {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #34d399;
      background: rgba(52, 211, 153, 0.1);
      border: 1px solid rgba(52, 211, 153, 0.2);
      padding: 2px 8px;
      border-radius: 9999px;
    }

    .bogo-title {
      font-size: 13px;
      font-weight: 800;
      color: #ffffff;
      margin-bottom: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .bogo-math {
      font-size: 12px;
      color: #a3a3a3;
      margin-bottom: 12px;
    }

    .bogo-math strong {
      color: #34d399;
    }

    .bogo-btn {
      width: 100%;
      background: #10b981;
      color: #ffffff;
      border: none;
      border-radius: 12px;
      padding: 12px;
      font-size: 13px;
      font-weight: 800;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: background 0.2s;
    }

    .bogo-btn:hover {
      background: #059669;
    }

    .bogo-close {
      cursor: pointer;
      color: #737373;
      font-size: 14px;
      background: none;
      border: none;
      padding: 0;
    }
  `;

  // 5. SHADOW DOM HTML STRUCTURE
  const wrapper = document.createElement('div');
  wrapper.className = 'bogo-floating-badge';
  wrapper.innerHTML = `
    <div class="bogo-header">
      <span class="bogo-pill">${pillLabel}</span>
      <button class="bogo-close" id="bogoCloseBtn">✕</button>
    </div>
    <div class="bogo-title" title="${title}">${title}</div>
    <div class="bogo-math">
      Retail: $${price.toFixed(2)} ➔ <strong>Your Share: $${userShare.toFixed(2)} (${dealBadgeText})</strong>
    </div>
    <button class="bogo-btn" id="bogoStartSplitBtn">
      <span>🚀 Start 50/50 Split Deal</span>
    </button>
  `;

  shadow.appendChild(style);
  shadow.appendChild(wrapper);

  // 6. EVENT HANDLERS
  shadow.getElementById('bogoCloseBtn').addEventListener('click', () => {
    hostDiv.remove();
  });

  shadow.getElementById('bogoStartSplitBtn').addEventListener('click', () => {
    const btn = shadow.getElementById('bogoStartSplitBtn');
    btn.innerText = '⚡ Initializing Lobby...';
    btn.disabled = true;

    chrome.runtime.sendMessage(
      {
        action: 'CREATE_LOBBY_FROM_DOM',
        payload: {
          itemName: title,
          itemPrice: price,
          dealType: activeDealType,
        },
      },
      (response) => {
        if (response && response.success && response.lobbyId) {
          window.open(
            `https://bogo-prototype-wheat.vercel.app/lobby/${response.lobbyId}`,
            '_blank'
          );
          btn.innerText = '🚀 Start 50/50 Split Deal';
          btn.disabled = false;
        } else {
          alert('Unable to create lobby: ' + (response ? response.error : 'Network error'));
          btn.innerText = '🚀 Start 50/50 Split Deal';
          btn.disabled = false;
        }
      }
    );
  });
})();
