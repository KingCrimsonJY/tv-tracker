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
import { en } from '../../src/i18n/messages/en.ts';
import { zhCN } from '../../src/i18n/messages/zh-CN.ts';

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
for (const [id, pinned] of [
  ['qa_pinned', true],
  ['qa_target', false],
] as const) {
  repo.putList(id, {
    name: id === 'qa_pinned' ? 'Pinned picks' : 'Batch target',
    kind: 'collection',
    pinned,
    rank: id === 'qa_pinned' ? 'a1' : 'a2',
    collectionSort: 'added',
    createdAt: Date.now(),
  });
}
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
/**
 * Every layout the shell has: phone (bottom tab bar, below 640px), tablet (navigation rail, 640-1023px)
 * and desktop (sidebar, from 1024px), two sizes each.
 */
const VIEWPORTS = [
  { width: 320, height: 844 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 820, height: 1180 },
  { width: 1280, height: 900 },
  { width: 1440, height: 900 },
] as const;
type Viewport = { width: number; height: number };
type Locale = 'en' | 'zh-CN';
const messages = (locale: Locale) => (locale === 'en' ? en : zhCN);
const formFactor = ({ width }: Viewport) => (width < 640 ? 'phone' : width < 1024 ? 'tablet' : 'desktop');

async function openPage(viewport: Viewport): Promise<Page> {
  const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
  await context.addCookies([{ name: 'zhenji_session', value: token, url: baseUrl, httpOnly: true, sameSite: 'Lax' }]);
  const page = await context.newPage();
  observe(page);
  return page;
}
const inViewport = (box: { x: number; y: number; width: number; height: number } | null, viewport: Viewport) =>
  box !== null &&
  box.x >= 0 &&
  box.y >= 0 &&
  box.x + box.width <= viewport.width + 1 &&
  box.y + box.height <= viewport.height + 1;

const capture = async (page: Page, name: string) => {
  await page.waitForTimeout(150);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), name + ' overflows');
  const file = name + '.png';
  await page.screenshot({ path: path.join(output, file), animations: 'disabled' });
  screenshots.push(file);
};
/** Each layout shows exactly one navigation, and everything the sidebar offers is reachable from it. */
async function verifyShell(page: Page, viewport: Viewport, locale: Locale, prefix: string) {
  const t = messages(locale);
  const layout = formFactor(viewport);
  await page.goto(baseUrl + '/library');
  await page.getByRole('heading', { level: 1 }).waitFor();
  const sidebar = page.getByRole('complementary', { name: t.app.desktopNavAria });
  const rail = page.getByRole('complementary', { name: t.app.tabletNavAria });
  const tabBar = page.getByRole('navigation', { name: t.app.mobileNavAria });
  assert.deepEqual(
    [await tabBar.isVisible(), await rail.isVisible(), await sidebar.isVisible()],
    [layout === 'phone', layout === 'tablet', layout === 'desktop'],
    prefix + ' shows the wrong navigation',
  );
  await capture(page, prefix + '-library');

  const pinnedHref = '/lists/qa_pinned';
  if (layout === 'desktop') {
    assert(await sidebar.locator(`a[href="${pinnedHref}"]`).isVisible(), 'Sidebar lacks the pinned list');
  } else if (layout === 'tablet') {
    for (const name of [t.nav.pinnedListsHeader, t.settings.title, t.app.signOut]) {
      const control = rail.getByRole(name === t.settings.title ? 'link' : 'button', { name, exact: true });
      assert(inViewport(await control.boundingBox(), viewport), `Rail control "${name}" is off screen`);
    }
    // Pinned lists open from the rail as real links: the app must not reload.
    await page.evaluate(() => Object.assign(window, { qaMarker: true }));
    await rail.getByRole('button', { name: t.nav.pinnedListsHeader, exact: true }).click();
    const item = page.getByRole('menuitem', { name: 'Pinned picks' });
    assert.equal(await item.getAttribute('href'), pinnedHref);
    await capture(page, prefix + '-rail-pinned');
    await item.click();
    await page.waitForURL(baseUrl + pinnedHref);
    await page.getByRole('heading', { level: 1, name: 'Pinned picks' }).waitFor();
    assert.equal(await page.evaluate(() => 'qaMarker' in window), true, 'Rail navigation reloaded the app');
  } else {
    await page.goto(baseUrl + '/');
    await page.getByRole('heading', { level: 1 }).waitFor();
    assert(await page.locator(`main a[href="${pinnedHref}"]`).first().isVisible(), 'Home lacks the pinned list');
    assert(inViewport(await tabBar.boundingBox(), viewport), 'Tab bar is off screen');
  }
}

/** A phone held sideways gets the rail with very little height: it must scroll instead of clipping. */
async function verifyShortLandscapeRail() {
  const viewport = { width: 844, height: 390 };
  const page = await openPage(viewport);
  await page.goto(baseUrl + '/library');
  const signOut = page.getByRole('complementary', { name: en.app.tabletNavAria }).getByRole('button', {
    name: en.app.signOut,
    exact: true,
  });
  await signOut.scrollIntoViewIfNeeded();
  assert(inViewport(await signOut.boundingBox(), viewport), 'Rail sign-out is unreachable in landscape');
  await capture(page, 'landscape-rail');
  await page.context().close();
}

/**
 * Library multi-select end to end, with a second device watching: selection by pointer and keyboard, the
 * action bar's position in each layout, and one atomic request and one synced event per batch.
 */
async function verifyBatchManagement(viewport: Viewport, locale: Locale) {
  const t = messages(locale);
  const text = t.library.batch;
  const layout = formFactor(viewport);
  const [page, other] = await Promise.all([openPage(viewport), openPage(viewport)]);
  await Promise.all([page, other].map((p) => p.goto(baseUrl + '/library')));
  await Promise.all([page, other].map((p) => p.locator('.poster-grid a').first().waitFor()));
  await other.waitForTimeout(400);
  const requests: Array<{ method: string; path: string }> = [];
  for (const p of [page, other])
    p.on('request', (request) => requests.push({ method: request.method(), path: new URL(request.url()).pathname }));
  const total = await page.locator('.poster-grid a').count();
  const ids = await page
    .locator('.poster-grid a')
    .evaluateAll((links) => links.slice(0, 4).map((link) => (link.getAttribute('href') ?? '').slice(7)));

  const toggleMode = page.getByRole('button', { name: text.select, exact: true });
  const done = page.getByRole('button', { name: text.done, exact: true });
  const toolbar = page.getByRole('toolbar', { name: text.toolbarAria });
  const count = toolbar.getByRole('status');
  const cards = page.getByRole('group', { name: text.gridAria }).getByRole('checkbox');
  const action = (name: string) => toolbar.getByRole('button', { name, exact: true });

  await toggleMode.click();
  await toolbar.waitFor();
  // The same button now leaves the mode, and keyboard focus stays on it.
  assert(await done.evaluate((button) => button === document.activeElement), 'Focus was lost entering selection');
  assert.equal(await count.innerText(), text.selectedCount(0));
  assert(await action(text.delete).isDisabled(), 'Batch actions must be disabled with nothing selected');
  // The checkboxes arrive with the grid's deferred render, which a slow machine finishes later.
  await cards.nth(total - 1).waitFor({ state: 'attached' });
  assert.equal(await cards.count(), total);

  // The bar stays inside the content area and never covers the phone tab bar.
  const bar = await toolbar.boundingBox();
  assert(bar && inViewport(bar, viewport), 'Batch toolbar is off screen at ' + viewport.width);
  assert(bar.x >= (layout === 'desktop' ? 256 : layout === 'tablet' ? 80 : 0), 'Batch toolbar overlaps the navigation');
  if (layout === 'phone') {
    const tabBar = await page.getByRole('navigation', { name: t.app.mobileNavAria }).boundingBox();
    assert(tabBar && bar.y + bar.height <= tabBar.y, 'Batch toolbar covers the tab bar');
  }

  // Pointer, then keyboard only.
  await cards.nth(0).click({ force: true });
  await cards.nth(1).focus();
  await page.keyboard.press('Space');
  assert.equal(await count.innerText(), text.selectedCount(2));
  // The grid follows the selection in a deferred render; wait for it rather than for a fixed time.
  const checked = page.getByRole('group', { name: text.gridAria }).getByRole('checkbox', { checked: true });
  await checked.nth(1).waitFor({ state: 'attached' });
  assert.deepEqual(
    [await cards.nth(0).isChecked(), await cards.nth(1).isChecked(), await cards.nth(2).isChecked()],
    [true, true, false],
  );
  await capture(page, ['batch', locale, viewport.width].join('-'));
  await page.keyboard.press('Control+a');
  assert.equal(await count.innerText(), text.selectedCount(total));
  await page.getByRole('button', { name: text.deselectAll, exact: true }).click();
  assert.equal(await count.innerText(), text.selectedCount(0));
  await page.getByRole('button', { name: text.selectAll, exact: true }).click();
  assert.equal(await count.innerText(), text.selectedCount(total));
  await page.keyboard.press('Escape');
  await toolbar.waitFor({ state: 'hidden' });
  assert.equal(await page.locator('.poster-grid a').count(), total, 'Leaving selection must restore the links');

  const select = async (indexes: number[]) => {
    await toggleMode.click();
    for (const index of indexes) await cards.nth(index).click({ force: true });
    assert.equal(await count.innerText(), text.selectedCount(indexes.length));
  };
  const batchRequests = () => requests.filter((r) => r.method === 'POST' && r.path === '/api/titles/batch').length;

  // Status: one request, shown on the other device from the single event.
  await select([0, 1, 2]);
  await action(text.setStatus).click();
  await page.getByRole('menuitem', { name: text.status.paused, exact: true }).click();
  await toolbar.waitFor({ state: 'hidden' });
  await page.getByText(text.statusDone(3), { exact: true }).waitFor();
  for (const id of ids.slice(0, 3)) {
    assert.equal(repo.getTitle(id)?.manualState, 'paused');
    await other.locator(`a[href="/title/${id}"]`).getByText(t.status.paused, { exact: true }).waitFor();
  }
  assert.equal(batchRequests(), 1);

  // Add to a list from the picker.
  await select([0, 1, 2]);
  await action(text.addToList).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Batch target' }).click();
  await toolbar.waitFor({ state: 'hidden' });
  await page.getByText(text.addedToList(3, 'Batch target'), { exact: true }).waitFor();
  assert.deepEqual(
    (repo.getState().entriesByList.qa_target ?? []).map((entry) => entry.titleId),
    ids.slice(0, 3),
  );
  assert.equal(batchRequests(), 2);

  // Delete needs a confirmation and removes the titles everywhere.
  await select([3]);
  await action(text.delete).click();
  const confirm = page.getByRole('alertdialog');
  await confirm.getByText(text.deleteTitle(1), { exact: true }).waitFor();
  assert.notEqual(repo.getTitle(ids[3]), null, 'Nothing may be deleted before confirming');
  await confirm.getByRole('button', { name: text.delete, exact: true }).click();
  await toolbar.waitFor({ state: 'hidden' });
  assert.equal(repo.getTitle(ids[3]), null);
  await other.locator(`a[href="/title/${ids[3]}"]`).waitFor({ state: 'detached' });
  assert.equal(await page.locator('.poster-grid a').count(), total - 1);
  assert.equal(batchRequests(), 3);
  assert.equal(requests.filter((r) => r.path === '/api/state').length, 0, 'A batch must sync without refetching state');

  // Undo the pause and empty the list so the next layout starts from the same library.
  for (const entry of repo.getState().entriesByList.qa_target ?? []) repo.deleteListEntry('qa_target', entry.id);
  repo.applyTitleBatch(ids.slice(0, 3), { type: 'status', status: 'active', todayStr: '2000-01-01', now: Date.now() });
  await Promise.all([page, other].map((p) => p.context().close()));
}

try {
  for (const locale of ['en', 'zh-CN'] as const) {
    // English runs in the dark theme and Chinese in the light one; the swapped pairs follow below.
    const theme = locale === 'en' ? 'dark' : 'light';
    repo.patchSettings({ uiLang: locale, theme });
    for (const viewport of VIEWPORTS) {
      const { width } = viewport;
      const page = await openPage(viewport);
      const context = page.context();
      const prefix = locale + '-' + width;
      await page.goto(baseUrl + '/title/tmdb_movie_1288');
      await page.getByRole('heading', { level: 1 }).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), theme);
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
      await verifyShell(page, viewport, locale, prefix);
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
  for (const viewport of VIEWPORTS) {
    const { width } = viewport;
    const page = await openPage(viewport);
    const context = page.context();
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

  // The other half of the language x theme matrix, once per layout.
  for (const locale of ['en', 'zh-CN'] as const) {
    const theme = locale === 'en' ? 'light' : 'dark';
    repo.patchSettings({ uiLang: locale, theme });
    for (const viewport of [VIEWPORTS[1], VIEWPORTS[3], VIEWPORTS[4]]) {
      const page = await openPage(viewport);
      for (const route of ['/', '/library', '/lists', '/settings']) {
        await page.goto(baseUrl + route);
        await page.getByRole('heading', { level: 1 }).waitFor();
        assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), theme);
        await capture(page, [locale, theme, viewport.width, route.slice(1) || 'home'].join('-'));
      }
      await page.context().close();
    }
  }

  for (const [index, viewport] of [VIEWPORTS[0], VIEWPORTS[1], VIEWPORTS[3], VIEWPORTS[4]].entries()) {
    const locale: Locale = index % 2 ? 'zh-CN' : 'en';
    repo.patchSettings({ uiLang: locale, theme: index % 2 ? 'light' : 'dark' });
    await verifyBatchManagement(viewport, locale);
    console.log('Verified batch management at ' + viewport.width + ' (' + locale + ')');
  }

  repo.patchSettings({ uiLang: 'en', theme: 'dark' });
  await verifyShortLandscapeRail();
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
    navigationShell: 'passed',
    batchManagement: 'passed',
    viewports: VIEWPORTS.map((viewport) => viewport.width),
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
