import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || '');

interface EmailNotificationPayload {
  hostEmail: string;
  partnerEmail: string;
  itemName: string;
  totalPrice: number;
  trackingNumber: string;
  shippingLabelUrl: string;
  partnerAddress: {
    name: string;
    street1: string;
    city: string;
    state: string;
    zip: string;
  };
}

export async function sendMatchCompletionEmails(payload: EmailNotificationPayload) {
  const {
    hostEmail,
    partnerEmail,
    itemName,
    totalPrice,
    trackingNumber,
    shippingLabelUrl,
    partnerAddress,
  } = payload;

  const partnerFormattedAddress = `${partnerAddress.name}, ${partnerAddress.street1}, ${partnerAddress.city}, ${partnerAddress.state} ${partnerAddress.zip}`;

  // 1. Send Email to Host (User A) with Printable Shipping Label
  const hostEmailPromise = resend.emails.send({
    from: 'BOGO Split <onboarding@resend.dev>',
    to: [hostEmail],
    subject: `🎉 BOGO Match Confirmed! Print Your Shipping Label for ${itemName}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #2563eb;">Great news! Your BOGO deal is confirmed.</h2>
        <p>A partner has joined your split for <strong>${itemName}</strong> (Total: $${totalPrice.toFixed(2)}).</p>
       
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #111827;">Action Required: Ship Partner's Item</h3>
          <p style="margin-bottom: 5px;"><strong>Ship To:</strong> ${partnerFormattedAddress}</p>
          <p style="margin-bottom: 15px;"><strong>Tracking Number:</strong> ${trackingNumber}</p>
         
          <a href="${shippingLabelUrl}" target="_blank" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 6px; font-weight: bold; display: inline-block;">
            📄 Download & Print Prepaid USPS Shipping Label
          </a>
        </div>
       
        <p style="font-size: 12px; color: #6b7280;">Thank you for using BOGO Split!</p>
      </div>
    `,
  });

  // 2. Send Confirmation Email to Partner (User B) with Tracking Details
  const partnerEmailPromise = resend.emails.send({
    from: 'BOGO Split <onboarding@resend.dev>',
    to: [partnerEmail],
    subject: `🚚 BOGO Match Confirmed! Tracking Info for ${itemName}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #059669;">Your BOGO Split Order is Confirmed!</h2>
        <p>Your payment half for <strong>${itemName}</strong> has been authorized and captured.</p>
       
        <div style="background-color: #ecfdf5; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #a7f3d0;">
          <h3 style="margin-top: 0; color: #065f46;">Shipping Details</h3>
          <p style="margin-bottom: 5px;"><strong>Delivering To:</strong> ${partnerFormattedAddress}</p>
          <p style="margin-bottom: 0;"><strong>USPS Tracking Number:</strong> <code style="background: #ffffff; padding: 2px 6px; border-radius: 4px;">${trackingNumber}</code></p>
        </div>
       
        <p>The host will print the prepaid shipping label and send your item shorty.</p>
        <p style="font-size: 12px; color: #6b7280;">Thank you for using BOGO Split!</p>
      </div>
    `,
  });

  await Promise.all([hostEmailPromise, partnerEmailPromise]);
}
