'use client';

function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

export interface CaptureToPdfOptions {
  orientation?: 'portrait' | 'landscape';
  format?: 'a4' | 'letter';
  pixelRatio?: number;
  margins?: number;
}

function prepareElementForCapture(el: HTMLElement, targetCssW: number) {
  const orig: Record<string, string> = {};
  ['width', 'maxWidth', 'overflow', 'margin', 'marginLeft', 'marginRight'].forEach(k => {
    orig[k] = el.style[k as any] || '';
  });
  el.style.width = `${targetCssW}px`;
  el.style.maxWidth = 'none';
  el.style.overflow = 'visible';
  el.style.margin = '0';
  el.style.marginLeft = '0';
  el.style.marginRight = '0';
  return orig;
}

function restoreElementStyles(el: HTMLElement, orig: Record<string, string>) {
  for (const [k, v] of Object.entries(orig)) {
    (el.style as any)[k] = v;
  }
}

async function captureWithToPng(
  element: HTMLElement,
  pixelRatio: number
): Promise<string> {
  await document.fonts.ready;
  await new Promise(r => requestAnimationFrame(r));
  const { toPng } = await import('html-to-image');
  return toPng(element, {
    quality: 1,
    pixelRatio,
    backgroundColor: '#ffffff',
  });
}

/**
 * Capture an element to PNG with proper sizing.
 */
export async function captureElementAsPNG(
  element: HTMLElement,
  filename = 'export',
  pixelRatio = 2
): Promise<void> {
  const targetCssW = Math.round((210 / 25.4) * 96);
  const orig = prepareElementForCapture(element, targetCssW);
  try {
    const dataUrl = await captureWithToPng(element, pixelRatio);
    downloadDataUrl(dataUrl, `${filename}.png`);
  } finally {
    restoreElementStyles(element, orig);
  }
}

/**
 * Capture an element to PDF with aspect-ratio preservation and multi-page support.
 */
export async function captureElementAsPDF(
  element: HTMLElement,
  filename = 'export',
  pixelRatio = 2,
  options?: { orientation?: 'portrait' | 'landscape'; format?: 'a4' | 'letter'; pdfWidth?: number; pdfHeight?: number }
): Promise<void> {
  const orient = options?.orientation ?? 'portrait';
  const hasCustomSize = options?.pdfWidth && options?.pdfHeight;
  const format = hasCustomSize ? [options.pdfWidth!, options.pdfHeight!] : (options?.format ?? 'a4');

  const { default: jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: orient, unit: 'mm', format });
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = pdf.internal.pageSize.getHeight();

  const targetCssW = Math.round((pdfW / 25.4) * 96);
  const orig = prepareElementForCapture(element, targetCssW);

  try {
    const dataUrl = await captureWithToPng(element, pixelRatio);

    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = dataUrl;
    });

    const imgW = img.naturalWidth;
    const imgH = img.naturalHeight;
    const cssW = imgW / pixelRatio;
    const cssH = imgH / pixelRatio;
    const mmW = (cssW / 96) * 25.4;
    const mmH = (cssH / 96) * 25.4;

    const pageContentH = pdfH;
    const totalPages = Math.max(1, Math.ceil(mmH / pageContentH));

    for (let i = 0; i < totalPages; i++) {
      if (i > 0) pdf.addPage();

      if (totalPages === 1 && mmH <= pageContentH) {
        const scale = Math.min(pdfW / mmW, pdfH / mmH);
        const finalW = mmW * scale;
        const finalH = mmH * scale;
        const x = (pdfW - finalW) / 2;
        const y = (pdfH - finalH) / 2;
        pdf.addImage(dataUrl, 'PNG', x, y, finalW, finalH, undefined, 'FAST');
      } else {
        const pageTopMm = i * pageContentH;
        const pageBottomMm = Math.min((i + 1) * pageContentH, mmH);
        const srcY = Math.round((pageTopMm / mmH) * imgH);
        const srcH = Math.round(((pageBottomMm - pageTopMm) / mmH) * imgH);

        const canvas = document.createElement('canvas');
        canvas.width = imgW;
        canvas.height = srcH;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, srcY, imgW, srcH, 0, 0, imgW, srcH);
        const pageDataUrl = canvas.toDataURL('image/png');

        const scale = pdfW / mmW;
        const h = srcH * (25.4 / 96) * scale / pixelRatio;
        pdf.addImage(pageDataUrl, 'PNG', 0, 0, pdfW, h, undefined, 'FAST');
      }
    }

    pdf.save(`${filename}.pdf`);
  } finally {
    restoreElementStyles(element, orig);
  }
}

/**
 * Create a hidden iframe from an HTML string and capture its contents as PNG.
 * Uses an iframe to ensure proper document context for CSS @page, @font-face, and mm units.
 */
export async function captureHTMLInIframe(
  html: string,
  pixelRatio: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:absolute;left:-9999px;top:0;width:210mm;height:297mm;border:none;';
    document.body.appendChild(iframe);

    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    };

    // Timeout to prevent hanging if fonts never load (e.g., Google Fonts unreachable)
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Font loading timeout'));
    }, 15000);

    const handleLoad = () => {
      try {
        const doc = iframe.contentDocument;
        if (!doc) throw new Error('iframe contentDocument not available');

        const body = doc.body;
        const targetEl = body.firstElementChild as HTMLElement || body;

        Promise.race([
          doc.fonts.ready,
          new Promise<void>((_, rejectTimeout) =>
            setTimeout(() => rejectTimeout(new Error('iframe font loading timeout')), 10000)
          ),
        ]).then(async () => {
          // Extra render frame to ensure layout is complete
          await new Promise(r => requestAnimationFrame(r));
          await new Promise(r => requestAnimationFrame(r));
          try {
            const { toPng } = await import('html-to-image');
            const dataUrl = await toPng(targetEl, {
              quality: 1,
              pixelRatio,
              backgroundColor: '#ffffff',
            });
            clearTimeout(timeout);
            cleanup();
            resolve(dataUrl);
          } catch (err) {
            clearTimeout(timeout);
            cleanup();
            reject(err);
          }
        }).catch((err) => {
          clearTimeout(timeout);
          cleanup();
          reject(err);
        });
      } catch (err) {
        clearTimeout(timeout);
        cleanup();
        reject(err);
      }
    };

    iframe.onload = handleLoad;
    iframe.srcdoc = html;
  });
}

export async function captureHTMLAsPNG(
  html: string,
  filename = 'export',
  pixelRatio = 2
): Promise<void> {
  const dataUrl = await captureHTMLInIframe(html, pixelRatio);
  downloadDataUrl(dataUrl, `${filename}.png`);
}

export async function captureHTMLAsPDF(
  html: string,
  filename = 'export',
  pixelRatio = 2,
  options?: { orientation?: 'portrait' | 'landscape'; format?: 'a4' | 'letter'; pdfWidth?: number; pdfHeight?: number }
): Promise<void> {
  const dataUrl = await captureHTMLInIframe(html, pixelRatio);

  const { default: jsPDF } = await import('jspdf');
  const orient = options?.orientation ?? 'portrait';
  const hasCustomSize = options?.pdfWidth && options?.pdfHeight;
  const format = hasCustomSize ? [options.pdfWidth!, options.pdfHeight!] : (options?.format ?? 'a4');
  const pdf = new jsPDF({ orientation: orient, unit: 'mm', format });
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = pdf.internal.pageSize.getHeight();

  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = dataUrl;
  });

  const imgW = img.naturalWidth;
  const imgH = img.naturalHeight;
  const cssW = imgW / pixelRatio;
  const cssH = imgH / pixelRatio;
  const mmW = (cssW / 96) * 25.4;
  const mmH = (cssH / 96) * 25.4;

  const pageContentH = pdfH;
  const totalPages = Math.max(1, Math.ceil(mmH / pageContentH));

  for (let i = 0; i < totalPages; i++) {
    if (i > 0) pdf.addPage();

    if (totalPages === 1 && mmH <= pageContentH) {
      const scale = Math.min(pdfW / mmW, pdfH / mmH);
      const finalW = mmW * scale;
      const finalH = mmH * scale;
      pdf.addImage(dataUrl, 'PNG', (pdfW - finalW) / 2, (pdfH - finalH) / 2, finalW, finalH, undefined, 'FAST');
    } else {
      const pageTopMm = i * pageContentH;
      const pageBottomMm = Math.min((i + 1) * pageContentH, mmH);
      const srcY = Math.round((pageTopMm / mmH) * imgH);
      const srcH = Math.round(((pageBottomMm - pageTopMm) / mmH) * imgH);

      const canvas = document.createElement('canvas');
      canvas.width = imgW;
      canvas.height = srcH;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, srcY, imgW, srcH, 0, 0, imgW, srcH);
      const pageDataUrl = canvas.toDataURL('image/png');

      const scale = pdfW / mmW;
      const h = srcH * (25.4 / 96) * scale / pixelRatio;
      pdf.addImage(pageDataUrl, 'PNG', 0, 0, pdfW, h, undefined, 'FAST');
    }
  }

  pdf.save(`${filename}.pdf`);
}
