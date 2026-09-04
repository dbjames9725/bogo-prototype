import { NextResponse } from 'next/server';
import { runAutomatedCheckout } from '../../../worker/checkout';

export async function POST(req: Request) {
  try {
    const { lobbyId } = await req.json();

    if (!lobbyId) {
      return NextResponse.json({ error: 'Missing lobbyId' }, { status: 400 });
    }

    // Trigger Playwright worker asynchronously in the background
    runAutomatedCheckout({ lobbyId }).catch((err: Error) => {
      console.error('Background worker error:', err.message);
    });

    return NextResponse.json({
      success: true,
      message: 'Automated fulfillment worker initiated.',
      lobbyId,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
