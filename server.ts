import dotenv from 'dotenv';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { createApp } from './server/app.ts';
import { todayDateStr } from './server/db/backup.ts';
import {
  assertDataDirWritable,
  DataDirPermissionError,
  TrackerRepository,
} from './server/db/repository.ts';
import {
  getYtdlpBinaryPath,
  getYtdlpVersion,
  updateYtdlpBinary,
} from './server/providers/ytdlp.ts';

dotenv.config();

async function startServer(): Promise<void> {
  const resolvedDataDir = path.resolve(process.env.DATA_DIR || './data');
  try {
    assertDataDirWritable(resolvedDataDir);
  } catch (err) {
    if (err instanceof DataDirPermissionError) {
      console.error(err.message);
      process.exit(1);
    }
    throw err;
  }

  const repo = new TrackerRepository({ dataDir: resolvedDataDir });
  let lastYtdlpUpdateDate = '';

  const ytdlpPath = getYtdlpBinaryPath();
  const ytdlpVersion = await getYtdlpVersion({ binaryPath: ytdlpPath });
  console.log(`[yt-dlp] path=${ytdlpPath} version=${ytdlpVersion ?? 'not installed'}`);

  const runMaintenanceCycle = () => {
    const today = todayDateStr();
    try {
      repo.runDailyMaintenance(today);
    } catch (err) {
      console.warn('Daily maintenance warning:', err);
    }
    if (lastYtdlpUpdateDate !== today) {
      lastYtdlpUpdateDate = today;
      void updateYtdlpBinary();
    }
  };

  runMaintenanceCycle();

  // Schedule daily backup + JSON export + yt-dlp self-update check every 6 hours
  const maintenanceTimer = setInterval(runMaintenanceCycle, 6 * 60 * 60 * 1000);
  maintenanceTimer.unref?.();

  const app = createApp({ repo });
  const httpServer = http.createServer(app);
  const PORT = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const disableHmr = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: disableHmr ? false : { server: httpServer },
      },
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

  // Node runs as PID 1 in the production image; handle container stop explicitly.
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    clearInterval(maintenanceTimer);
    const finish = () => {
      repo.close();
      process.exit(0);
    };
    httpServer.close(finish);
    // SSE clients can otherwise keep the server open indefinitely.
    setTimeout(() => {
      httpServer.closeAllConnections();
      finish();
    }, 5_000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
