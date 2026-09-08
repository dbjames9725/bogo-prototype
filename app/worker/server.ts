import express from 'express';
import { runAutomatedCheckout } from './checkout';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;
const WORKER_SECRET = process.env.WORKER_SECRET || 'bogo_secret_token_123';

// Health check endpoint for Railway
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', worker: 'BOGO Split Playwright Agent' });
});

// Trigger checkout execution
app.post('/api/run-checkout', async (req, res) => {
  const authHeader = req.headers.authorization;

  if (authHeader !== `Bearer ${WORKER_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized worker request' });
  }

  const { lobbyId } = req.body;

  if (!lobbyId) {
    return res.status(400).json({ error: 'Missing lobbyId parameter' });
  }

  // Respond immediately so the caller isn't blocked by long-running automation
  res.status(202).json({
    message: 'Playwright stealth checkout worker queued',
    lobbyId,
  });

  // Run Playwright task asynchronously in the background
  try {
    await runAutomatedCheckout({ lobbyId });
  } catch (err: any) {
    console.error(`Worker Execution Error for Lobby ${lobbyId}:`, err.message);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Playwright Worker Service listening on port ${PORT}`);
});
