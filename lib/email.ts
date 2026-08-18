import { Resend } from 'resend';

export interface EmailNotificationPayload {
  lobbyId?: string;
  itemName: string;
  userAAddress: {
    name?: string;
    street1: string;
    city: string;
    state: string;
    zip: string;
  };
  userBAddress: {
    name?: string;
    street1: string;
    city: string;
    state: string;
    zip: string;
  };
  shippingLabelUrl?: string;
  trackingCode?: string;
}

export async function sendMatchCompletionEmails(payload: EmailNotificationPayload) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is missing. Skipping email dispatch.');
    return;
  }

  // Instantiate Resend at runtime inside the function body
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { itemName, userAAddress, userBAddress, shippingLabelUrl, trackingCode } = payload;

  try {
    await resend.emails.send({
      from: 'BOGO Splitting <notifications@resend.dev>',
      to: ['delivered@resend.dev'], // Update to host/partner emails when ready
      subject: `BOGO Match Confirmed: ${itemName}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; line-height: 1.5;">
          <h2>Your BOGO Split Match is Confirmed! 🎉</h2>
          <p>Great news! Both payments have been authorized and captured for <strong>${itemName}</strong>.</p>
         
          <h3>Shipping Instructions for Host:</h3>
          <p>Please use the generated shipping label below to send the second item to your partner:</p>
          ${
            shippingLabelUrl
              ? `<p><a href="${shippingLabelUrl}" style="background-color: #2563eb; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px; display: inline-block;">Download Shipping Label</a></p>`
              : '<p><em>Shipping label pending generation. Check dashboard.</em></p>'
          }
          ${trackingCode ? `<p><strong>Tracking Code:</strong> ${trackingCode}</p>` : ''}

          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
         
          <h3>Partner Shipping Address:</h3>
          <p>
            ${userBAddress?.name || 'Partner'}<br />
            ${userBAddress?.street1}<br />${userBAddress?.city}, ${userBAddress?.state}${userBAddress?.zip}
          </p>
        </div>
      `,
    });
  } catch (error: any) {
    console.error('Failed to send match completion email:', error.message);
  }
}
