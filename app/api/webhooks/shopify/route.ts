import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '../../../../lib/supabase';

// Helper function to verify Shopify HMAC signature
async function verifyShopifyHmac(request: Request, rawBody: string) {
  const hmacHeader = request.headers.get('x-shopify-hmac-sha256');
  const secret = process.env.SHOPIFY_API_SECRET;

  if (!hmacHeader || !secret) return false;

  const hash = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('base64');

  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hmacHeader));
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const isValid = await verifyShopifyHmac(request, rawBody);

    if (!isValid) {
      return NextResponse.json({ error: 'Unauthorized webhook request' }, { status: 401 });
    }

    const topic = request.headers.get('x-shopify-topic');
    const body = JSON.parse(rawBody);

    switch (topic) {
      case 'customers/data_request': {
        // Customer requested a copy of their data
        console.log(`[Webhook] Data request for customer ${body.customer?.id} on ${body.shop_domain}`);
        // BOGO Engine does not store personal customer PII, return 200 OK
        break;
      }

      case 'customers/redact': {
        // Customer requested deletion of their data
        console.log(`[Webhook] Customer redact for customer ${body.customer?.id} on ${body.shop_domain}`);
        // Delete any customer-specific records if applicable
        break;
      }

      case 'shop/redact': {
        // Merchant uninstalled app + 48 hrs passed. Clean up merchant database records.
        console.log(`[Webhook] Shop redact for store: ${body.shop_domain}`);
       
        if (body.shop_domain) {
          // Clean up merchant campaigns and OAuth tokens
          await supabaseAdmin.from('bogo_campaigns').delete().eq('shop_domain', body.shop_domain);
          await supabaseAdmin.from('merchants').delete().eq('shop_domain', body.shop_domain);
        }
        break;
      }

      default:
        console.warn(`[Webhook] Unhandled topic: ${topic}`);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    console.error('[Webhook Error]:', err.message);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
