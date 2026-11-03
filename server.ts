import dotenv from 'dotenv';
import express from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { createApp } from './server/app.ts';
import { TrackerRepository } from './server/db/repository.ts';

dotenv.config();

async function startServer(): Promise<void> {
  const repo = new TrackerRepository();

  try {
    repo.runDailyMaintenance();
  } catch (err) {
    console.warn('Daily maintenance warning on startup:', err);
  }

  // Schedule daily backup + JSON export check every 6 hours
  const maintenanceTimer = setInterval(() => {
    try {
      repo.runDailyMaintenance();
    } catch (err) {
      console.warn('Scheduled daily maintenance warning:', err);
    }
  }, 6 * 60 * 60 * 1000);
  maintenanceTimer.unref?.();

  const app = createApp({ repo });
  const PORT = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
