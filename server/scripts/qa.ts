import express from 'express';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium, type Page } from 'playwright';
import { createApp } from '../app.ts';
import { generateSessionToken, hashPassword, SESSION_TTL_MS } from '../auth.ts';
import { TrackerRepository } from '../db/repository.ts';
import { seedPerfFixture, PERF_FIRST_TITLE, PERF_LONG_TITLE } from './perf-fixture.ts';
import type { SeasonDoc } from '../../src/domain/types.ts';

const runDir = mkdtempSync(path.join(tmpdir(), 'zhenji-qa-'));
const output = path.resolve(process.env.QA_OUTPUT_DIR || path.join(runDir, 'screenshots'));
mkdirSync(output, { recursive: true });
const repo = new TrackerRepository({ dataDir: runDir });
seedPerfFixture(repo);
const title = repo.getTitle(PERF_FIRST_TITLE);
assert(title);
const local = repo.getSeasons(title.id);
const source: SeasonDoc[] = Array.from({ length: 5 }, (_, index) => ({
  seasonNumber: index + 1,
  name: { en: 'Chapter ' + (index + 1), zh: '篇章 ' + (index + 1) },
  episodes: local[0].episodes.slice(index * 8, index * 8 + 8).map((episode, position) => ({
    ...episode,
    number: position + 1,
    key: 's' + (index + 1) + 'e' + (position + 1),
  })),
}));
repo.refreshMetadata(title.id, { title, seasons: source });
repo.applyTitleAtomicAction(PERF_LONG_TITLE, {
  progress: {
    playthroughId: 'p1',
    set: Object.fromEntries(Array.from({ length: 120 }, (_, index) => ['s1e' + (index + 1), Date.now()])),
  },
});
repo.setStoredPasswordHash(hashPassword('qa-only-not-a-user-password'));
const { token, tokenHash } = generateSessionToken();
repo.createSession(tokenHash, Date.now(), Date.now() + SESSION_TTL_MS);
const app = createApp({ repo, isProduction: true });
app.use('/perf-assets', express.static(path.resolve('public')));
app.use(express.static(path.resolve('dist')));
app.get('*', (_req, res) => res.sendFile(path.resolve('dist/index.html')));
const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const address = server.address();
assert(address && typeof address !== 'string');
const baseUrl = 'http://127.0.0.1:' + address.port;
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const errors: string[] = [];
const screenshots: string[] = [];
const observe = (page: Page) => {
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
};
const capture = async (page: Page, name: string) => {
  await page.waitForTimeout(150);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), name + ' overflows');
  const file = name + '.png';
  await page.screenshot({ path: path.join(output, file), animations: 'disabled' });
  screenshots.push(file);
};
try {
  for (const locale of ['en', 'zh-CN'] as const) {
    repo.patchSettings({ uiLang: locale });
    for (const width of [320, 390, 1280]) {
      const context = await browser.newContext({
        viewport: { width, height: width === 1280 ? 900 : 844 },
        serviceWorkers: 'block',
      });
      await context.addCookies([
        { name: 'zhenji_session', value: token, url: baseUrl, httpOnly: true, sameSite: 'Lax' },
      ]);
      const page = await context.newPage();
      observe(page);
      const prefix = locale + '-' + width;
      await page.goto(baseUrl + '/title/tmdb_movie_1288');
      await page.getByRole('heading', { level: 1 }).waitFor();
      assert.equal(
        await page.getByText(locale === 'en' ? 'Source and season structure' : '来源与季结构', { exact: true }).count(),
        0,
      );
      await capture(page, prefix + '-movie');

      await page.goto(baseUrl + '/title/' + title.id);
      const preview = page.getByRole('button', { name: locale === 'en' ? 'Preview changes' : '预览变更', exact: true });
      await preview.waitFor();
      await preview.evaluate((button) => button.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await capture(page, prefix + '-upstream');
      await preview.click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();
      assert(!/\bs\d+e\d+\b/.test(await dialog.innerText()), 'Preview exposes an internal episode key');
      await capture(page, prefix + '-preview');

      await page.goto(baseUrl + '/title/' + PERF_LONG_TITLE);
      const range = page.getByRole('button').filter({ hasText: '101–150' });
      await range.waitFor();
      await range.scrollIntoViewIfNeeded();
      await range.click();
      await page.getByRole('option', { name: '151–200', exact: true }).waitFor();
      await capture(page, prefix + '-ranges');
      await page.getByRole('option', { name: '151–200', exact: true }).click();
      await page.locator('#episode-s1e151').waitFor();
      assert.equal(await page.locator('[id^="episode-"]').count(), 50);
      assert.equal(await page.locator('#episode-s1e101').count(), 0);
      await context.close();
      console.log('Verified ' + prefix);
    }
  }

  // Long, unbroken user text must wrap: list headers keep their actions on screen.
  repo.putList('qa_long_list', {
    name: 'W'.repeat(80),
    description: 'D'.repeat(200),
    kind: 'ordered',
    pinned: true,
    rank: 'a0',
    collectionSort: 'manual',
    createdAt: Date.now(),
  });
  for (const width of [320, 390, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: 'block' });
    await context.addCookies([{ name: 'zhenji_session', value: token, url: baseUrl, httpOnly: true, sameSite: 'Lax' }]);
    const page = await context.newPage();
    observe(page);
    await page.goto(baseUrl + '/lists/qa_long_list');
    await page.getByRole('heading', { level: 1 }).waitFor();
    await capture(page, 'long-list-name-' + width);
    for (const button of await page.locator('main button').filter({ visible: true }).all()) {
      const box = await button.boundingBox();
      assert(box && box.x >= 0 && box.x + box.width <= width + 1, 'List header action is off screen at ' + width);
    }
    await context.close();
  }
  repo.deleteList('qa_long_list');

  repo.patchSettings({ uiLang: 'en' });
  const contexts = await Promise.all(
    [0, 1].map(async () => {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
      await context.addCookies([
        { name: 'zhenji_session', value: token, url: baseUrl, httpOnly: true, sameSite: 'Lax' },
      ]);
      return context;
    }),
  );
  const pages = await Promise.all(contexts.map((context) => context.newPage()));
  for (const page of pages) observe(page);
  await Promise.all(pages.map((page) => page.goto(baseUrl + '/title/' + title.id)));
  await Promise.all(
    pages.map((page) =>
      page.getByRole('checkbox', { name: 'Unmark Season 1 Episode 1 watched', exact: true }).waitFor(),
    ),
  );
  await Promise.all(pages.map((page) => page.waitForTimeout(500)));
  const requests: Array<{ method: string; url: string }> = [];
  for (const page of pages)
    page.on('request', (request) => requests.push({ method: request.method(), url: request.url() }));
  await pages[0].getByRole('checkbox', { name: 'Unmark Season 1 Episode 1 watched', exact: true }).press('Space');
  await Promise.all(
    pages.map((page) => page.getByRole('checkbox', { name: 'Mark Season 1 Episode 1 watched', exact: true }).waitFor()),
  );
  assert.equal(requests.filter((request) => request.method === 'POST').length, 1);
  assert.equal(requests.filter((request) => new URL(request.url).pathname === '/api/state').length, 0);
  const detailsBefore = requests.filter((request) => request.url.endsWith('/details')).length;
  await pages[0].getByRole('link', { name: 'Library', exact: true }).click();
  await pages[0].locator('a[href="/title/' + title.id + '"]').click();
  await pages[0].getByRole('checkbox', { name: 'Mark Season 1 Episode 1 watched', exact: true }).waitFor();
  await pages[0].waitForTimeout(300);
  assert.equal(
    requests.filter((request) => request.url.endsWith('/details')).length,
    detailsBefore,
    'Detail cache missed on route return',
  );
  // Chinese IME input: composition text must never be committed into the search field.
  // QA runs without a TMDB key; answer the debounced search locally so it stays offline and error-free.
  await pages[0].route('**/api/tmdb/search**', (route) => route.fulfill({ json: { configured: true, results: [] } }));
  await pages[0].goto(baseUrl + '/search');
  const searchInput = pages[0].getByRole('searchbox');
  await searchInput.click();
  const ime = await pages[0].context().newCDPSession(pages[0]);
  for (const text of ['f', 'fa', 'fan', "fan'r", "fan'ren"]) {
    await ime.send('Input.imeSetComposition', { text, selectionStart: text.length, selectionEnd: text.length });
    await pages[0].waitForTimeout(40);
  }
  await ime.send('Input.insertText', { text: '凡人' });
  await pages[0].waitForTimeout(400);
  assert.equal(await searchInput.inputValue(), '凡人', 'IME composition text leaked into the search field');
  assert.equal(new URL(pages[0].url()).searchParams.get('q'), '凡人');
  await ime.detach();
  await pages[0].unroute('**/api/tmdb/search**');
  await pages[0].goto(baseUrl + '/title/' + title.id);
  await pages[0].getByRole('heading', { level: 1 }).waitFor();

  const backup = repo.exportData();
  delete backup.titles[title.id];
  delete backup.seasonsByTitle[title.id];
  delete backup.progressByTitle[title.id];
  const imported = await pages[0].request.post(baseUrl + '/api/import', { data: backup, headers: { Origin: baseUrl } });
  assert.equal(imported.status(), 200);
  await Promise.all(pages.map((page) => page.getByText('Title not found', { exact: true }).waitFor()));
  for (const context of contexts) await context.close();
  assert.deepEqual(errors, []);
  const report = {
    screenshots,
    errors,
    crossDeviceToggle: 'passed',
    detailCache: 'passed',
    backupReplacement: 'passed',
    imeSearchInput: 'passed',
    longListName: 'passed',
  };
  writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
  console.log('Screenshots: ' + output);
} finally {
  await browser.close();
  const stop: unknown = app.locals.stopBackgroundTasks;
  if (typeof stop === 'function') stop();
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  repo.close();
}
