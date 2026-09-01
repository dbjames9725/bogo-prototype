(function () {
  const BOGO_APP_URL = 'https://bogo-prototype-wheat.vercel.app';
  let isInitializing = false;

  // Safe multi-strategy price extractor
  function extractPrice(priceElement) {
    if (!priceElement) return null;

    // 1. Prefer explicit data attributes or meta tag content (most accurate, unformatted)
    const rawData =
      priceElement.getAttribute('data-product-price') ||
      priceElement.getAttribute('content');

    if (rawData) {
      const parsedAttr = parseFloat(rawData);
      if (!isNaN(parsedAttr) && parsedAttr > 0) {
        // Handle values formatted in cents (e.g., 6973 vs 69.73)
        return rawData.includes('.') ? parsedAttr : parsedAttr / 100;
      }
    }

    // 2. Extract numeric sequences matching standard currency patterns ($XX.XX, XX.XX €)
    const textContent = priceElement.innerText || priceElement.textContent || '';
    const matches = textContent.match(/\d+[\.,]\d{2}/g);

    if (matches && matches.length > 0) {
      // Normalize values (convert commas to dots) and parse floats
      const parsedPrices = matches.map((m) => parseFloat(m.replace(',', '.')));
     
      // Filter out invalid/zero numbers and pick the lowest price (handles sale/strike-through prices)
      const validPrices = parsedPrices.filter((p) => !isNaN(p) && p > 0);
      if (validPrices.length > 0) {
        return Math.min(...validPrices);
      }
    }

    return null;
  }

  function initBogoWidget() {
    if (document.getElementById('bogo-split-container') || isInitializing) return;
    isInitializing = true;

    try {
      // Query common Shopify and e-commerce price selectors
      const priceElement = document.querySelector(
        '[data-product-price], .price, .product-price, .current-price, span.price-item--sale, .product-single__price, .price__regular .price-item--regular'
      );

      // Query product title selector
      const titleElement = document.querySelector(
        '[data-product-title], .product-title, h1.product-title, h1.product__title, h1'
      );

      const itemPrice = extractPrice(priceElement);
      if (!itemPrice || isNaN(itemPrice)) {
        isInitializing = false;
        return;
      }

      const itemName = titleElement
        ? (titleElement.innerText || titleElement.textContent).trim()
        : 'BOGO Split Item';

      const halfPrice = (itemPrice / 2).toFixed(2);

      // Create Container Element
      const widgetContainer = document.createElement('div');
      widgetContainer.id = 'bogo-split-container';
      widgetContainer.style.cssText =
        'margin: 16px 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;';

      widgetContainer.innerHTML = `
        <button type="button" id="bogo-split-btn" style="
          width: 100%;
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: #ffffff;
          font-weight: 700;
          font-size: 15px;
          padding: 14px 20px;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
          transition: transform 0.1s ease, box-shadow 0.1s ease;
        ">
          <span style="display: flex; align-items: center; gap: 8px;">
            <span style="background: rgba(255,255,255,0.2); padding: 4px 8px; border-radius: 6px; font-size: 11px; text-transform: uppercase;">BOGO Split</span>
            <span>Split This Deal</span>
          </span>
          <span style="font-size: 14px; opacity: 0.95;">Pay only $${halfPrice} ➔</span>
        </button>
      `;

      // Find best injection target
      const addToCartBtn = document.querySelector(
        'form[action*="/cart/add"] button, form[action*="/cart/add"] input[type="submit"], button[name="add"], .add-to-cart, #AddToCart, .product-form__submit'
      );

      if (addToCartBtn && addToCartBtn.parentNode) {
        addToCartBtn.parentNode.insertBefore(widgetContainer, addToCartBtn.nextSibling);
      } else if (priceElement && priceElement.parentNode) {
        priceElement.parentNode.appendChild(widgetContainer);
      }

      // Attach Click Event
      const btn = document.getElementById('bogo-split-btn');
      if (btn) {
        btn.addEventListener('click', async function (e) {
          e.preventDefault();
          btn.disabled = true;
          btn.style.opacity = '0.75';
          btn.innerHTML = `<span>Creating BOGO Split Lobby...</span>`;

          // Collect selected variants (size, color, etc.)
          const selectedVariant = {};
          const selectElements = document.querySelectorAll(
            'form[action*="/cart/add"] select, form[action*="/cart/add"] input[type="radio"]:checked'
          );
          selectElements.forEach((el) => {
            if (el.name || el.id) {
              selectedVariant[el.name || el.id] = el.value;
            }
          });

          try {
            const response = await fetch(`${BOGO_APP_URL}/api/create-lobby`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                itemName: itemName,
                itemPrice: itemPrice,
                dealType: 'BOGO_FREE',
                userAShare: itemPrice / 2,
                userBShare: itemPrice / 2,
                userAVariant: selectedVariant,
              }),
            });

            const data = await response.json();

            if (data.lobbyId) {
              try {
                localStorage.setItem(`hosted_${data.lobbyId}`, 'true');
              } catch (e) {
                console.warn('LocalStorage unavailable:', e);
              }

              window.location.href = `${BOGO_APP_URL}/lobby/${data.lobbyId}`;
            } else {
              alert('Unable to start BOGO lobby: ' + (data.error || 'Unknown error'));
              btn.disabled = false;
              btn.style.opacity = '1';
              btn.innerHTML = `<span>Split This Deal</span><span>Pay only $${halfPrice} ➔</span>`;
            }
          } catch (err) {
            alert('Network error initiating BOGO Split lobby.');
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.innerHTML = `<span>Split This Deal</span><span>Pay only $${halfPrice} ➔</span>`;
          }
        });
      }
    } finally {
      isInitializing = false;
    }
  }

  // Initial Load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBogoWidget);
  } else {
    initBogoWidget();
  }

  // MutationObserver Strategy: Re-inject widget if DOM changes (SPA navigations / Variant switches)
  let observerTimeout;
  const observer = new MutationObserver(() => {
    if (!document.getElementById('bogo-split-container')) {
      clearTimeout(observerTimeout);
      observerTimeout = setTimeout(initBogoWidget, 250); // Debounce to prevent layout thrashing
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
})();
