import type { Orientation } from './types';

let chromium: any;
let puppeteer: typeof import('puppeteer');

// Browser pool: reuse a single Chromium instance instead of launching per request
let sharedBrowser: any = null;
let browserRefCount = 0;
let browserIdleTimer: ReturnType<typeof setTimeout> | null = null;

const BROWSER_IDLE_TIMEOUT_MS = 60_000; // close after 60s idle
const BROWSER_LAUNCH_TIMEOUT_MS = 30_000;

async function launchBrowser() {
  if (!puppeteer) {
    puppeteer = await import('puppeteer');
  }
  try {
    chromium = await import('@sparticuz/chromium');
    return puppeteer.launch({
      args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none', '--disable-web-security', '--allow-file-access-from-files'],
      defaultViewport: { width: 1200, height: 1600 },
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
  } catch {
    return puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none', '--disable-web-security', '--allow-file-access-from-files'],
      defaultViewport: { width: 1200, height: 1600 },
      headless: true,
    });
  }
}

async function acquireBrowser() {
  // If idle timer is pending, cancel it (we're about to use the browser)
  if (browserIdleTimer) {
    clearTimeout(browserIdleTimer);
    browserIdleTimer = null;
  }

  // If browser exists and is still connected, reuse it
  if (sharedBrowser && sharedBrowser.connected) {
    browserRefCount++;
    return sharedBrowser;
  }

  // Launch a new browser (with timeout)
  browserRefCount++;
  sharedBrowser = await Promise.race([
    launchBrowser(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Browser launch timed out')), BROWSER_LAUNCH_TIMEOUT_MS)
    ),
  ]);
  return sharedBrowser;
}

function releaseBrowser() {
  browserRefCount = Math.max(0, browserRefCount - 1);
  if (browserRefCount === 0) {
    // Schedule close after idle timeout
    browserIdleTimer = setTimeout(async () => {
      if (sharedBrowser && browserRefCount === 0) {
        try { await sharedBrowser.close(); } catch { /* ignore */ }
        sharedBrowser = null;
      }
    }, BROWSER_IDLE_TIMEOUT_MS);
  }
}

// Clean up browser on process exit
if (typeof process !== 'undefined') {
  process.on('exit', () => {
    if (sharedBrowser) {
      try { sharedBrowser.close(); } catch { /* ignore */ }
    }
  });
}

export interface GeneratePdfOptions {
  html: string;
  orientation?: Orientation;
}

async function withPage<T>(orientation: Orientation | undefined, fn: (page: any) => Promise<T>): Promise<T> {
  const browser = await acquireBrowser();
  const page = await browser.newPage();
  try {
    if (orientation === 'landscape') {
      await page.setViewport({ width: 1123, height: 794 });
    } else {
      await page.setViewport({ width: 794, height: 1123 });
    }
    return await fn(page);
  } finally {
    await page.close();
    releaseBrowser();
  }
}

export async function generatePdfFromHtml(options: GeneratePdfOptions): Promise<Buffer> {
  return withPage(options.orientation, async (page) => {
    await page.setContent(options.html, { waitUntil: 'networkidle0' as any });
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({
      format: 'A4',
      landscape: options.orientation === 'landscape',
      printBackground: true,
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
    });
    return Buffer.from(pdf);
  });
}

export async function generatePngFromHtml(options: GeneratePdfOptions): Promise<Buffer> {
  return withPage(options.orientation, async (page) => {
    await page.setContent(options.html, { waitUntil: 'networkidle0' as any });
    await page.evaluate(() => document.fonts.ready);
    const png = await page.screenshot({ fullPage: true, type: 'png' });
    return Buffer.from(png);
  });
}

export async function generatePdfFromUrl(url: string): Promise<Buffer> {
  return withPage(undefined, async (page) => {
    await page.goto(url, { waitUntil: 'networkidle0' as any });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
    });
    return Buffer.from(pdf);
  });
}
