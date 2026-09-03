import { Resend } from 'resend';

export interface OrderEmailProps {
  lobbyId: string;
  itemName: string;
  itemPrice: number;
  userAAddress: any;
  userBAddress: any;
  userAVariant?: any;
  userBVariant?: any;
}

export async function sendMatchNotificationEmail(data: OrderEmailProps) {
  const apiKey = process.env.RESEND_API_KEY;
  const merchantEmail = process.env.MERCHANT_NOTIFICATION_EMAIL;

  if (!apiKey || !merchantEmail) {
    console.warn('Skipping email notification: RESEND_API_KEY or MERCHANT_NOTIFICATION_EMAIL not configured.');
    return;
  }

  // Instantiate Resend lazily at execution time, avoiding build-time evaluation issues
  const resend = new Resend(apiKey);

  const { lobbyId, itemName, itemPrice, userAAddress, userBAddress, userAVariant, userBVariant } = data;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111827; background-color: #f3f4f6; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 24px; border: 1px solid #e5e7eb; }
          .header { border-bottom: 2px solid #10b981; padding-bottom: 12px; margin-bottom: 20px; }
          .badge { background: #d1fae5; color: #065f46; font-size: 12px; font-weight: 700; padding: 4px 8px; border-radius: 6px; text-transform: uppercase; }
          .title { font-size: 20px; font-weight: 800; margin: 8px 0; }
          .card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
          .card-header { font-size: 14px; font-weight: 700; color: #2563eb; margin-bottom: 8px; text-transform: uppercase; }
          .address-line { font-size: 13px; color: #374151; margin: 2px 0; }
          .variant { font-size: 12px; color: #6b7280; margin-top: 6px; font-style: italic; }
          .footer { font-size: 11px; color: #9ca3af; text-align: center; margin-top: 24px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <span class="badge">🎉 Action Required: Ship BOGO Split Order</span>
            <div class="title">Match Confirmed for ${itemName}</div>
            <p style="font-size: 13px; color: #6b7280; margin: 0;">Lobby ID: ${lobbyId} | Original Item Price: $${Number(itemPrice || 0).toFixed(2)}</p>
          </div>

          <p style="font-size: 14px;">Both payment holds have been captured successfully. Please fulfill and ship the two split items to the addresses below:</p>

          <div class="card">
            <div class="card-header">👑 Host (Buyer 1) Shipping Address</div>
            <div class="address-line"><strong>Name:</strong> ${userAAddress?.name || 'N/A'}</div>
            <div class="address-line"><strong>Street:</strong> ${userAAddress?.street1 || 'N/A'}</div>
            <div class="address-line"><strong>City/State/ZIP:</strong> ${userAAddress?.city || ''}, ${userAAddress?.state || ''} ${userAAddress?.zip || ''}</div>
            <div class="address-line"><strong>Phone:</strong> ${userAAddress?.phone || 'N/A'}</div>
            ${userAVariant ? `<div class="variant">Options Selected: ${JSON.stringify(userAVariant)}</div>` : ''}
          </div>

          <div class="card">
            <div class="card-header">🤝 Partner (Buyer 2) Shipping Address</div>
            <div class="address-line"><strong>Name:</strong> ${userBAddress?.name || 'N/A'}</div>
            <div class="address-line"><strong>Street:</strong> ${userBAddress?.street1 || 'N/A'}</div>
            <div class="address-line"><strong>City/State/ZIP:</strong> ${userBAddress?.city || ''}, ${userBAddress?.state || ''} ${userBAddress?.zip || ''}</div>
            <div class="address-line"><strong>Phone:</strong> ${userBAddress?.phone || 'N/A'}</div>
            ${userBVariant ? `<div class="variant">Options Selected: ${JSON.stringify(userBVariant)}</div>` : ''}
          </div>

          <div class="footer">
            Sent automatically by BOGO Split Platform • Captured via Stripe manual hold Engine
          </div>
        </div>
      </body>
    </html>
  `;

  await resend.emails.send({
    from: 'BOGO Split Orders <onboarding@resend.dev>',
    to: merchantEmail,
    subject: `📦 BOGO Split Match Confirmed: ${itemName} (Lobby #${lobbyId.slice(0, 8)})`,
    html: htmlContent,
  });
}
