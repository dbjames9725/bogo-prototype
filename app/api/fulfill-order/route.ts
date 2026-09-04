import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { lobbyId } = await req.json();

    if (!lobbyId) {
      return NextResponse.json({ error: 'Missing lobbyId' }, { status: 400 });
    }

    const railwayWorkerUrl = process.env.RAILWAY_WORKER_URL;
    const workerSecret = process.env.WORKER_SECRET;

    if (!railwayWorkerUrl) {
      console.error('RAILWAY_WORKER_URL environment variable is missing.');
      return NextResponse.json(
        { error: 'RAILWAY_WORKER_URL environment variable is missing.' },
        { status: 500 }
      );
    }

    // Trigger the stealth Playwright microservice running on Railway
    const response = await fetch(`${railwayWorkerUrl}/api/run-checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${workerSecret}`,
      },
      body: JSON.stringify({ lobbyId }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Railway worker returned an error' },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Playwright automation worker successfully triggered on Railway',
      lobbyId,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}