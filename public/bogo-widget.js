(function () {
  const BOGO_APP_URL = 'https://bogo-prototype-wheat.vercel.app';

  function initBogoWidget() {
    const priceElement = document.querySelector('[data-product-price], .price, .product-price, .current-price');
    const titleElement = document.querySelector('[data-product-title], .product-title, h1.product-title, h1');

    if (!priceElement) return;

    const priceText = priceElement.innerText || priceElement.textContent;
    const itemPrice = parseFloat(priceText.replace(/[^0-9.]/g, ''));
    const itemName = titleElement ? (titleElement.innerText || titleElement.textContent).trim() : 'BOGO Item';

    if (!itemPrice || isNaN(itemPrice)) return;

    const halfPrice = (itemPrice / 2).toFixed(2);

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

    const addToCartBtn = document.querySelector('form[action*="/cart/add"], button[name="add"], .add-to-cart, #AddToCart');
    if (addToCartBtn && addToCartBtn.parentNode) {
      addToCartBtn.parentNode.insertBefore(widgetContainer, addToCartBtn.nextSibling);
    } else if (priceElement.parentNode) {
      priceElement.parentNode.appendChild(widgetContainer);
    }

    document.getElementById('bogo-split-btn').addEventListener('click', async function () {
      const btn = this;
      btn.disabled = true;
      btn.style.opacity = '0.75';
      btn.innerText = 'Creating BOGO Lobby...';

      const selectedVariant = {};
      const selectElements = document.querySelectorAll('select, input[type="radio"]:checked');
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
          // CRITICAL: Mark this browser explicitly as the HOST before navigating
          try {
            localStorage.setItem(`hosted_${data.lobbyId}`, 'true');
          } catch (e) {
            console.error('LocalStorage write failed:', e);
          }
         
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBogoWidget);
  } else {
    initBogoWidget();
  }
})();
