import type { Orientation } from './types';

let chromium: any;
let puppeteer: typeof import('puppeteer');

async function getBrowser() {
  if (!puppeteer) {
    puppeteer = await import('puppeteer');
  }
  try {
    chromium = await import('@sparticuz/chromium');
    return puppeteer.launch({
      args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1200, height: 1600 },
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
  } catch {
    return puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1200, height: 1600 },
      headless: true,
    });
  }
}

export interface GeneratePdfOptions {
  html: string;
  orientation?: Orientation;
}

export async function generatePdfFromHtml(options: GeneratePdfOptions): Promise<Buffer> {
  const browser = await getBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(options.html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      landscape: options.orientation === 'landscape',
      printBackground: true,
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

export async function generatePdfFromUrl(url: string): Promise<Buffer> {
  const browser = await getBrowser();
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
