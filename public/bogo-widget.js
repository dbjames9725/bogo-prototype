(function () {
  // Configuration
  const BOGO_APP_URL = 'https://bogo-prototype-wheat.vercel.app';

  function initBogoWidget() {
    // Look for product page price/title on merchant DOM
    const priceElement = document.querySelector('[data-product-price], .price, .product-price, .current-price');
    const titleElement = document.querySelector('[data-product-title], .product-title, h1.product-title, h1');

    if (!priceElement) return;

    // Parse raw price text into number
    const priceText = priceElement.innerText || priceElement.textContent;
    const itemPrice = parseFloat(priceText.replace(/[^0-9.]/g, ''));
    const itemName = titleElement ? (titleElement.innerText || titleElement.textContent).trim() : 'BOGO Item';

    if (!itemPrice || isNaN(itemPrice)) return;

    // Calculate split preview price
    const halfPrice = (itemPrice / 2).toFixed(2);

    // Create container and button
    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'bogo-split-widget-container';
    widgetContainer.style.cssText = 'margin: 16px 0; font-family: system-ui, -apple-system, sans-serif;';

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

    // Insert widget right after the Add to Cart button or price
    const addToCartBtn = document.querySelector('form[action*="/cart/add"], button[name="add"], .add-to-cart, #AddToCart');
    if (addToCartBtn && addToCartBtn.parentNode) {
      addToCartBtn.parentNode.insertBefore(widgetContainer, addToCartBtn.nextSibling);
    } else if (priceElement.parentNode) {
      priceElement.parentNode.appendChild(widgetContainer);
    }

    // Click event to initiate lobby creation
    document.getElementById('bogo-split-btn').addEventListener('click', async function () {
      const btn = this;
      btn.disabled = true;
      btn.style.opacity = '0.75';
      btn.innerText = 'Creating BOGO Lobby...';

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
          }),
        });

        const data = await response.json();

        if (data.lobbyId) {
          // Redirect to the newly created lobby
          window.location.href = `${BOGO_APP_URL}/lobby/${data.lobbyId}`;
        } else {
          alert('Could not start lobby: ' + (data.error || 'Unknown error'));
          btn.disabled = false;
          btn.style.opacity = '1';
        }
      } catch (err) {
        alert('Network error initiating BOGO Split lobby.');
        btn.disabled = false;
        btn.style.opacity = '1';
      }
    });
  }

  // Initialize on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBogoWidget);
  } else {
    initBogoWidget();
  }
})();
