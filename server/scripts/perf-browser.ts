import { chromium, type Page, type Request } from 'playwright';
import { gzipSync } from 'node:zlib';
import { PERF_FIRST_TITLE, PERF_LONG_TITLE } from './perf-fixture.ts';

declare global {
  interface Window {
    perfLongTasks: { start: number; duration: number }[];
    perfInput: { start: number; firstFrame: number; updatedFrame: number } | null;
  }
}

export async function measureBrowser(baseUrl: string, token: string) {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    serviceWorkers: 'block',
  });
  await context.addCookies([{ name: 'zhenji_session', value: token, url: baseUrl, httpOnly: true, sameSite: 'Lax' }]);
  const page = await context.newPage();
  page.setDefaultTimeout(45_000);
  page.setDefaultNavigationTimeout(60_000);
  const session = await context.newCDPSession(page);
  await session.send('Network.enable');
  await session.send('Network.setCacheDisabled', { cacheDisabled: true });
  await session.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: 1_600_000 / 8,
    uploadThroughput: 750_000 / 8,
    connectionType: 'cellular4g',
  });
  await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.addInitScript(() => {
    window.perfLongTasks = [];
    window.perfInput = null;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        window.perfLongTasks.push({ start: entry.startTime, duration: entry.duration });
    }).observe({ type: 'longtask', buffered: true });
    document.addEventListener(
      'keydown',
      (event) => {
        if (event.key !== ' ') return;
        const element = event.target;
        if (!(element instanceof HTMLInputElement) || element.type !== 'checkbox') return;
        const input = { start: performance.now(), firstFrame: 0, updatedFrame: 0 };
        window.perfInput = input;
        requestAnimationFrame(() => {
          input.firstFrame = performance.now() - input.start;
          if (element.checked) input.updatedFrame = input.firstFrame;
        });
      },
      true,
    );
  });
  const errors: string[] = [];
  const requests: { url: string; method: string }[] = [];
  const activeStateReads = new Set<Request>();
  let lastStateActivity = Date.now();
  const isStateRead = (request: Request) => new URL(request.url()).pathname === '/api/state';
  const finishStateRead = (request: Request) => {
    if (activeStateReads.delete(request)) lastStateActivity = Date.now();
  };
  page.on('requestfinished', finishStateRead);
  page.on('requestfailed', finishStateRead);
  const waitForStateQuiet = async () => {
    const deadline = Date.now() + 60_000;
    while (activeStateReads.size || Date.now() - lastStateActivity < 600) {
      if (Date.now() > deadline) throw new Error('State requests did not settle within 60 seconds');
      await page.waitForTimeout(100);
    }
  };
  const scripts = new Map<string, number>();
  const scriptReads: Promise<void>[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('request', (request) => {
    requests.push({ url: request.url(), method: request.method() });
    if (isStateRead(request)) {
      activeStateReads.add(request);
      lastStateActivity = Date.now();
    }
  });
  page.on('response', (response) => {
    if (response.request().resourceType() === 'script')
      scriptReads.push(
        response.body().then((body) => {
          scripts.set(response.url(), gzipSync(body).length);
        }),
      );
  });
  const longestTask = async (after: number) =>
    page.evaluate(
      (start) =>
        Math.max(0, ...window.perfLongTasks.filter((task) => task.start >= start).map((task) => task.duration)),
      after,
    );
  const timestamp = () => page.evaluate(() => performance.now());
  const settled = (target: Page) => target.waitForTimeout(500);
  try {
    console.log('Measuring cold home load...');
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Continue Watching', exact: true }).waitFor();
    await page.locator(`a[href^="/title/${PERF_FIRST_TITLE}"]`).first().waitFor();
    const homeInteractiveMs = await timestamp();
    console.log('Home interactive ms:', homeInteractiveMs);
    await Promise.all(scriptReads);
    const homeJsGzipBytes = [...scripts.values()].reduce((sum, bytes) => sum + bytes, 0);
    await waitForStateQuiet();
    await settled(page);

    await page.getByRole('link', { name: 'Library', exact: true }).click();
    await page.locator(`a[href="/title/${PERF_LONG_TITLE}"]`).waitFor({ state: 'attached' });
    await settled(page);
    console.log('Measuring library scrolling...');
    const scrollStart = await timestamp();
    for (let step = 0; step < 12; step++) {
      await page.mouse.wheel(0, 700);
      await page.waitForTimeout(100);
    }
    await settled(page);
    const libraryScrollLongTaskMs = await longestTask(scrollStart);

    console.log('Measuring long-title opening...');
    const openStart = await timestamp();
    await page.locator(`a[href="/title/${PERF_LONG_TITLE}"]`).click();
    await page.getByRole('heading', { name: 'Long archive', exact: true }).waitFor();
    await page.getByRole('checkbox', { name: 'Mark Season 1 Episode 1 watched', exact: true }).waitFor();
    await settled(page);
    const longTitleOpenMs = (await timestamp()) - openStart;
    const longTitleLongTaskMs = await longestTask(openStart);
    const episodeRows = await page.locator('[id^="episode-"]').count();

    console.log('Measuring episode toggle...');
    const toggleStart = await timestamp();
    const requestStart = requests.length;
    await Promise.all([
      page.waitForResponse((res) => res.url().includes('/actions') && res.request().method() === 'POST'),
      page.getByRole('checkbox', { name: 'Mark Season 1 Episode 1 watched', exact: true }).press('Space'),
    ]);
    await page.getByRole('checkbox', { name: 'Unmark Season 1 Episode 1 watched', exact: true }).waitFor();
    await page.waitForTimeout(600);
    await waitForStateQuiet();
    const toggleRequests = requests.slice(requestStart).filter((request) => request.url.includes('/api/'));
    return {
      homeInteractiveMs,
      homeJsGzipBytes,
      libraryScrollLongTaskMs,
      longTitleOpenMs,
      longTitleLongTaskMs,
      episodeRows,
      toggleLongTaskMs: await longestTask(toggleStart),
      toggleInput: await page.evaluate(() => window.perfInput),
      togglePosts: toggleRequests.filter((request) => request.method === 'POST').length,
      toggleStateGets: toggleRequests.filter(
        (request) => request.method === 'GET' && new URL(request.url).pathname === '/api/state',
      ).length,
      errors,
    };
  } catch (error) {
    console.error(
      'API requests:',
      requests.filter((request) => request.url.includes('/api/')),
    );
    console.error('Page state:', (await page.locator('body').innerText()).slice(0, 1600));
    console.error('Browser errors:', errors);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}
