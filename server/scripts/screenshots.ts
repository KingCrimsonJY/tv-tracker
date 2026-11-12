// Regenerate the README screenshots in docs/screenshots from the demo database.
//   npm run seed:demo && npm run build && npm run screenshots
// The demo database is copied to a temporary directory first; ./data-demo and DATA_DIR are never modified.
// Link import is served from the bundled yt-dlp fixture, so no upstream request is made for it.
import express from 'express';
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';
import { createApp } from '../app.ts';
import { generateSessionToken, hashPassword, SESSION_TTL_MS } from '../auth.ts';
import { TrackerRepository } from '../db/repository.ts';
import { zhCN } from '../../src/i18n/messages/zh-CN.ts';

const source = path.resolve(process.env.SCREENSHOT_DEMO_DIR || 'data-demo');
const output = path.resolve(process.env.SCREENSHOT_OUTPUT_DIR || 'docs/screenshots');
if (!existsSync(path.join(source, 'tracker.db'))) {
  console.error(`No demo database in ${source}. Run "npm run seed:demo" first.`);
  process.exit(1);
}

const runDir = mkdtempSync(path.join(tmpdir(), 'zhenji-screenshots-'));
for (const suffix of ['', '-wal', '-shm']) {
  const file = path.join(source, 'tracker.db' + suffix);
  if (existsSync(file)) copyFileSync(file, path.join(runDir, 'tracker.db' + suffix));
}
const repo = new TrackerRepository({ dataDir: runDir });
repo.patchSettings({ uiLang: 'zh-CN', theme: 'system' });
repo.setStoredPasswordHash(hashPassword('screenshots-only-not-a-user-password'));
const { token, tokenHash } = generateSessionToken();
repo.createSession(tokenHash, Date.now(), Date.now() + SESSION_TTL_MS);

// yt-dlp prints the JSON document on one line; the fixture is pretty-printed for review.
const ytdlpFixture = JSON.stringify(
  JSON.parse(readFileSync(path.resolve(import.meta.dirname, 'fixtures/ytdlp-3b1b-youtube.json'), 'utf8')),
);
const app = createApp({
  repo,
  isProduction: true,
  linkDeps: {
    lookupFn: async () => [{ address: '93.184.216.34' }],
    execFn: async (_file, args) => ({ stdout: args.includes('--version') ? '2026.01.01' : ytdlpFixture, stderr: '' }),
  },
});
app.use(express.static(path.resolve('dist')));
app.get('*', (_req, res) => res.sendFile(path.resolve('dist/index.html')));
const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const address = server.address();
assert(address && typeof address !== 'string');
const baseUrl = `http://127.0.0.1:${address.port}`;

const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
const tablet = { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const desktop = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 };
const errors: string[] = [];

async function openPage(
  browser: Browser,
  device: typeof phone | typeof tablet | typeof desktop,
  scheme: 'dark' | 'light',
) {
  const context = await browser.newContext({
    ...device,
    colorScheme: scheme,
    serviceWorkers: 'block',
    locale: 'zh-CN',
  });
  await context.addCookies([{ name: 'zhenji_session', value: token, url: baseUrl, httpOnly: true, sameSite: 'Lax' }]);
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return page;
}

async function settle(page: Page) {
  // SSE keeps a request open, so wait for images and fonts instead of network idle.
  await page.evaluate(async () => {
    await document.fonts.ready;
    const pending = [...document.images].filter((image) => !image.complete);
    await Promise.race([
      Promise.all(pending.map((image) => new Promise((done) => image.addEventListener('loadend', done)))),
      new Promise((done) => setTimeout(done, 8000)),
    ]);
  });
  await page.waitForTimeout(400);
}

/** Encode with the browser itself so the script needs no image library. */
async function saveWebp(browser: Browser, png: Buffer, name: string) {
  const page = await browser.newPage();
  const base64 = await page.evaluate(async (data) => {
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
    const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.82 });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }, png.toString('base64'));
  await page.close();
  writeFileSync(path.join(output, `${name}.webp`), Buffer.from(base64, 'base64'));
  console.log(`[screenshots] ${name}.webp`);
}

async function capture(browser: Browser, page: Page, name: string) {
  await settle(page);
  await saveWebp(browser, await page.screenshot({ animations: 'disabled' }), name);
}

const browser = await chromium.launch({ headless: true });
try {
  for (const scheme of ['dark', 'light'] as const) {
    const page = await openPage(browser, phone, scheme);
    await page.goto(`${baseUrl}/`);
    await page.getByRole('heading', { level: 1 }).waitFor();
    await capture(browser, page, scheme === 'dark' ? 'phone-home' : 'phone-home-light');
    await page.context().close();

    const wide = await openPage(browser, desktop, scheme);
    await wide.goto(`${baseUrl}/`);
    await wide.getByRole('heading', { level: 1 }).waitFor();
    await capture(browser, wide, scheme === 'dark' ? 'desktop-home' : 'desktop-home-light');
    if (scheme === 'dark') {
      await wide.goto(`${baseUrl}/title/tmdb_tv_95396`);
      await wide.getByRole('heading', { level: 1 }).waitFor();
      await capture(browser, wide, 'desktop-detail');
    }
    await wide.context().close();
  }

  const page = await openPage(browser, phone, 'dark');
  for (const [route, name] of [
    ['/title/tmdb_tv_95396', 'phone-detail'],
    ['/lists/list_marvel_order', 'phone-list'],
    ['/library', 'phone-library'],
    ['/title/url_bili_3b1b_linear_algebra', 'phone-playlist-detail'],
  ] as const) {
    await page.goto(baseUrl + route);
    await page.getByRole('heading', { level: 1 }).waitFor();
    await capture(browser, page, name);
  }

  // Library multi-select: a few titles picked, with the action bar above the tab bar.
  await page.goto(`${baseUrl}/library`);
  await page.getByRole('button', { name: zhCN.library.batch.select, exact: true }).click();
  const cards = page.locator('.poster-grid label');
  for (const index of [0, 2, 3]) await cards.nth(index).tap();
  await page.getByRole('toolbar').waitFor();
  await capture(browser, page, 'phone-library-select');
  await page.getByRole('button', { name: zhCN.library.batch.done, exact: true }).click();

  // The tablet layout: navigation rail with the same library.
  const railPage = await openPage(browser, tablet, 'dark');
  await railPage.goto(`${baseUrl}/library`);
  await railPage.getByRole('heading', { level: 1 }).waitFor();
  await capture(browser, railPage, 'tablet-library');
  await railPage.context().close();

  // Import preview of a playlist that is not in the library yet.
  repo.deleteTitle('url_yt_3b1b_linear_algebra');
  await page.goto(`${baseUrl}/search`);
  await page.getByRole('button', { name: '通过链接添加' }).click();
  await page
    .getByRole('textbox')
    .last()
    .fill('https://www.youtube.com/playlist?list=PLZHQObOWTQDPD3MizzM2xVFitgF8hE_ab');
  await page.getByRole('button', { name: '解析链接' }).click();
  await page.getByText('确认并保存解析结果').waitFor();
  // Let the "parsed" toast time out so it does not cover the dialog footer.
  await page.locator('.toast').first().waitFor({ state: 'detached', timeout: 15000 });
  await capture(browser, page, 'phone-link-import');
  await page.context().close();

  // The service worker registration fails on purpose (blocked above); anything else is a regression.
  const unexpected = errors.filter((message) => !/ServiceWorker|sw\.js/i.test(message));
  assert.deepEqual(unexpected, [], 'Browser console errors while capturing screenshots');
} finally {
  await browser.close();
  server.close();
  repo.close();
  rmSync(runDir, { recursive: true, force: true });
}
