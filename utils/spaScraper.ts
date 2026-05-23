// SPA scraper — headless browser fallback for JS-rendered pages.
// Keeps a single browser instance alive across requests.
// Supports both local dev (puppeteer with bundled Chromium) and serverless (puppeteer-core + @sparticuz/chromium-min).
import type { Browser } from 'puppeteer-core';
import type { Page } from 'puppeteer-core';

let browserPromise: Promise<Browser> | null = null;
let renderMutex: Promise<void> = Promise.resolve();

async function findChromiumPath(): Promise<string | undefined> {
  try {
    // @sparticuz/chromium-min — executablePath is available at runtime but not in TS types
    const chromium: any = await import('@sparticuz/chromium-min');
    return typeof chromium.executablePath === 'function'
      ? await chromium.executablePath()
      : undefined;
  } catch {
    // chromium-min not available — puppeteer will use its bundled browser
    return undefined;
  }
}

async function getBrowser(): Promise<Browser> {
  if (browserPromise) {
    try {
      const b = await browserPromise;
      if (b.isConnected()) return b;
    } catch { /* dead, relaunch */ }
  }

  const executablePath = await findChromiumPath();

  let puppeteerModule: typeof import('puppeteer-core');
  try {
    // Try puppeteer first (bundled Chromium, local dev)
    puppeteerModule = await import('puppeteer');
  } catch {
    // Fall back to puppeteer-core (serverless)
    puppeteerModule = await import('puppeteer-core');
  }

  browserPromise = puppeteerModule.launch({
    ...(executablePath ? { executablePath } : {}),
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  }) as Promise<Browser>;

  // Clean up on process exit
  const cleanup = async () => {
    try { const b = await browserPromise; await b?.close(); } catch { /* ignore */ }
    browserPromise = null;
  };
  process.once('exit', cleanup);
  process.once('SIGTERM', cleanup);
  process.once('SIGINT', cleanup);

  return browserPromise;
}

export interface RenderedPage {
  html: string;
  url: string; // final URL after redirects
}

/** Render a page using headless Chrome. Waits for network idle.
 *  Serialises concurrent calls via a mutex so the shared page is never
 *  navigated by two requests at the same time. */
export async function renderPage(url: string, timeoutMs = 20_000): Promise<RenderedPage> {
  // Serialise concurrent renders: only one caller drives the shared page at a time.
  const prev = renderMutex;
  let release!: () => void;
  renderMutex = new Promise<void>((resolve) => { release = resolve; });
  await prev;

  const browser = await getBrowser();
  try {
    const pages = await browser.pages();
    let page: Page;
    if (pages.length > 0) {
      page = pages[0];
    } else {
      page = await browser.newPage();
    }

    try {
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      );
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9,pl;q=0.8' });

      await page.goto(url, { waitUntil: 'networkidle2', timeout: timeoutMs });

      const html = await page.content();
      const finalUrl = page.url();

      return { html, url: finalUrl };
    } finally {
      // Don't close page — reuse for next request
    }
  } finally {
    release();
  }
}
