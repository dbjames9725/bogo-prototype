import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Apply stealth plugin to playwright-extra
chromium.use(stealthPlugin());

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16' as any,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface CheckoutPayload {
  lobbyId: string;
}

export async function runAutomatedCheckout({ lobbyId }: CheckoutPayload) {
  // 1. Fetch Lobby & Address Data from Supabase
  const { data: lobby, error } = await supabase
    .from('lobbies')
    .select('*')
    .eq('id', lobbyId)
    .single();

  if (error || !lobby || !lobby.issuing_card_id) {
    throw new Error(`Invalid lobby or missing virtual card ID for lobby ${lobbyId}`);
  }

  const hostAddress = lobby.user_a_address;

  // 2. Retrieve Sensitive Unmasked Virtual Card Details from Stripe
  const sensitiveCard = await stripe.issuing.cards.retrieve(lobby.issuing_card_id, {
    expand: ['number', 'cvc'],
  });

  const cardNumber = (sensitiveCard as any).number;
  const cardCvc = (sensitiveCard as any).cvc;
  const expMonth = String(sensitiveCard.exp_month).padStart(2, '0');
  const expYear = String(sensitiveCard.exp_year).slice(-2);

  console.log(`🥷 Launching Stealth Automated Checkout for Lobby: ${lobbyId}`);

  // 3. Launch Stealth Browser Context
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled', // Mask automation flag
      '--disable-infobars',
      '--window-size=1920,1080',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'America/New_York',
  });

  const page = await context.newPage();

  try {
    // -------------------------------------------------------------
    // STEALTH AUTOMATION SEQUENCE
    // -------------------------------------------------------------

    // Navigate to product URL with human-like timing
    await page.goto(lobby.item_url || 'https://example-retailer.com/product', {
      waitUntil: 'domcontentloaded',
    });

    // Human-like pause delay (1-2s)
    await page.waitForTimeout(1500);

    // Quantity selection (2 for BOGO deal)
    const quantitySelector = 'select[name="quantity"], input[name="quantity"]';
    if (await page.isVisible(quantitySelector)) {
      await page.fill(quantitySelector, '2');
    }

    // Click Add to Cart
    await page.click('button[type="submit"]:has-text("Add to Cart"), button:has-text("Add to Bag")');
    await page.waitForTimeout(2500);

    // Navigate to Checkout Page
    await page.goto('https://example-retailer.com/checkout', { waitUntil: 'networkidle' });

    // Inject Contact & Shipping Info
    await page.fill('input[name="email"]', 'fulfillment@bogosplit.com');
    await page.fill('input[name="firstName"], input[autocomplete="given-name"]', hostAddress.name.split(' ')[0] || 'Host');
    await page.fill('input[name="lastName"], input[autocomplete="family-name"]', hostAddress.name.split(' ')[1] || 'User');
    await page.fill('input[name="address1"], input[autocomplete="address-line1"]', hostAddress.street1);
    await page.fill('input[name="city"], input[autocomplete="address-level2"]', hostAddress.city);
    await page.selectOption('select[name="zone"], select[autocomplete="address-level1"]', hostAddress.state);
    await page.fill('input[name="postalCode"], input[autocomplete="postal-code"]', hostAddress.zip);
    await page.fill('input[name="phone"], input[autocomplete="tel"]', hostAddress.phone);

    await page.click('button:has-text("Continue to shipping"), button:has-text("Continue")');
    await page.waitForTimeout(2000);

    // Inject Payment Information securely (handling potential payment iframe)
    const cardIframe = page.frameLocator('iframe[title*="card"], iframe[title*="Payment"]');

    if (cardIframe) {
      await cardIframe.locator('input[name="number"], input[autocomplete="cc-number"]').fill(cardNumber);
      await cardIframe.locator('input[name="expiry"], input[autocomplete="cc-exp"]').fill(`${expMonth}/${expYear}`);
      await cardIframe.locator('input[name="cvc"], input[autocomplete="cc-csc"]').fill(cardCvc);
    } else {
      await page.fill('input[autocomplete="cc-number"]', cardNumber);
      await page.fill('input[autocomplete="cc-exp"]', `${expMonth}/${expYear}`);
      await page.fill('input[autocomplete="cc-csc"]', cardCvc);
    }

    // Submit Order
    await page.click('button:has-text("Pay now"), button:has-text("Complete order")');
    await page.waitForNavigation({ waitUntil: 'networkidle' });

    // Extract Order Confirmation
    const confirmationText = await page.innerText('body');
    const orderMatch = confirmationText.match(/(?:Order|Confirmation)\s*#?\s*([A-Z0-9-]+)/i);
    const orderNumber = orderMatch ? orderMatch[1] : 'CONFIRMED_' + Date.now();

    console.log(`✅ Stealth Order Executed Cleanly! Confirmation #: ${orderNumber}`);

    // Update Supabase
    await supabase
      .from('lobbies')
      .update({
        status: 'FULFILLED',
        order_confirmation_number: orderNumber,
      })
      .eq('id', lobbyId);

  } catch (err: any) {
    console.error(`❌ Stealth Checkout Failed for Lobby ${lobbyId}:`, err.message);

    await supabase
      .from('lobbies')
      .update({ status: 'FULFILLMENT_FAILED' })
      .eq('id', lobbyId);

  } finally {
    await browser.close();
  }
}
