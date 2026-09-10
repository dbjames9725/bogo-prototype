import express, { Request, Response } from 'express';
import { runAutomatedCheckout } from './checkout';

const app = express();
app.use(express.json());

// Railway injects PORT automatically; default to 3001
const PORT = process.env.PORT || 3001;
const WORKER_SECRET = process.env.WORKER_SECRET || 'bogo_secret_token_123';

// Root & Health Check Endpoints
app.get('/', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'BOGO Playwright Worker is live' });
});

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', worker: 'BOGO Split Playwright Agent' });
});

// Primary Async Checkout Execution Endpoint
app.post('/api/run-checkout', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || authHeader !== `Bearer ${WORKER_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized dispatch request' });
  }

  const { lobbyId } = req.body;

  if (!lobbyId) {
    return res.status(400).json({ error: 'Missing lobbyId in request body' });
  }

  console.log(`Received checkout execution request for Lobby ID: ${lobbyId}`);

  // Return HTTP 202 Accepted immediately so Vercel does not block or timeout
  res.status(202).json({
    success: true,
    message: 'Checkout job dispatched to background worker',
    lobbyId,
  });

  // Run the Playwright automation sequence in background
  runAutomatedCheckout({ lobbyId }).catch((err) => {
    console.error(`Unhandled exception in Playwright execution for Lobby ${lobbyId}:`, err);
  });
});

// Bind to 0.0.0.0 explicitly (REQUIRED for Railway containers)
app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Playwright Worker Service listening on 0.0.0.0:${PORT}`);
});


