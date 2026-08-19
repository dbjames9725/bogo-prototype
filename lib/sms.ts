import twilio from 'twilio';

interface SmsPayload {
  toPhone: string;
  itemName: string;
  trackingCode?: string;
}

export async function sendHostMatchSms({ toPhone, itemName, trackingCode }: SmsPayload) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !twilioPhone) {
    console.warn('Twilio credentials missing in environment variables. Skipping SMS.');
    return;
  }

  if (!toPhone) {
    console.warn('No host phone number provided. Skipping SMS dispatch.');
    return;
  }

  try {
    const client = twilio(accountSid, authToken);

    const messageBody = `🎉 BOGO Split Match Alert! A partner has joined your lobby for "${itemName}". Your return shipping label has been generated.${
      trackingCode ? ` Tracking Code: ${trackingCode}` : ''
    }`;

    await client.messages.create({
      body: messageBody,
      from: twilioPhone,
      to: toPhone,
    });

    console.log(`SMS notification successfully sent to ${toPhone}`);
  } catch (err: any) {
    console.error('Twilio SMS Dispatch Failed:', err.message);
  }
}
