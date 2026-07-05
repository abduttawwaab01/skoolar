'use client';

async function ensureFontsAndRender(): Promise<void> {
  await document.fonts.ready;
  await new Promise((r) => requestAnimationFrame(r));
}

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

/**
 * Capture an element to PNG with proper sizing.
 * Resizes the element to match the PDF content width before capture
 * to ensure full content is rendered and captured.
 */
export async function captureElementAsPNG(
  element: HTMLElement,
  filename = 'export',
  pixelRatio = 2
): Promise<void> {
  await ensureFontsAndRender();
  const { toPng } = await import('html-to-image');
  const dataUrl = await toPng(element, {
    quality: 1,
    pixelRatio,
    cacheBust: true,
  });
  downloadDataUrl(dataUrl, `${filename}.png`);
}

/**
 * Capture an element to PDF with aspect-ratio preservation and multi-page support.
 * The element is resized to match the PDF content width before capture,
 * ensuring full content is rendered and properly laid out.
 */
export async function captureElementAsPDF(
  element: HTMLElement,
  filename = 'export',
  pixelRatio = 2,
  options?: { orientation?: 'portrait' | 'landscape'; format?: 'a4' | 'letter'; pdfWidth?: number; pdfHeight?: number }
): Promise<void> {
  await ensureFontsAndRender();
  const orient = options?.orientation ?? 'portrait';
  const hasCustomSize = options?.pdfWidth && options?.pdfHeight;
  const format = hasCustomSize ? [options.pdfWidth!, options.pdfHeight!] : (options?.format ?? 'a4');

  const { default: jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: orient, unit: 'mm', format });
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = pdf.internal.pageSize.getHeight();

  // Resize element to match PDF content width for proper layout
  const targetCssW = Math.round((pdfW / 25.4) * 96);
  const origWidth = element.style.width;
  const origMaxWidth = element.style.maxWidth;
  const origOverflow = element.style.overflow;
  element.style.width = `${targetCssW}px`;
  element.style.maxWidth = 'none';
  element.style.overflow = 'visible';

  await new Promise(r => requestAnimationFrame(r));

  try {
    const { toPng } = await import('html-to-image');
    const dataUrl = await toPng(element, {
      quality: 1,
      pixelRatio,
      cacheBust: true,
    });

    // Get image dimensions
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

    // Calculate pages needed
    const pageContentH = pdfH;
    const totalPages = Math.max(1, Math.ceil(mmH / pageContentH));

    for (let i = 0; i < totalPages; i++) {
      if (i > 0) pdf.addPage();

      if (totalPages === 1 && mmH <= pageContentH) {
        // Single page - center with aspect-ratio preservation
        const scale = Math.min(pdfW / mmW, pdfH / mmH);
        const finalW = mmW * scale;
        const finalH = mmH * scale;
        const x = (pdfW - finalW) / 2;
        const y = (pdfH - finalH) / 2;
        pdf.addImage(dataUrl, 'PNG', x, y, finalW, finalH, undefined, 'FAST');
      } else {
        // Multi-page - extract image portion via canvas
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
  } finally {
    // Restore original styles
    element.style.width = origWidth;
    element.style.maxWidth = origMaxWidth;
    element.style.overflow = origOverflow;
  }

  pdf.save(`${filename}.pdf`);
}

export async function captureHTMLAsPNG(
  html: string,
  filename = 'export',
  pixelRatio = 2
): Promise<void> {
  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.cssText = 'position:absolute;left:-9999px;top:0;';
  document.body.appendChild(container);
  try {
    await ensureFontsAndRender();
    const { toPng } = await import('html-to-image');
    const dataUrl = await toPng(container, {
      quality: 1,
      pixelRatio,
      cacheBust: true,
    });
    downloadDataUrl(dataUrl, `${filename}.png`);
  } finally {
    if (container.parentNode) container.parentNode.removeChild(container);
  }
}

export async function captureHTMLAsPDF(
  html: string,
  filename = 'export',
  pixelRatio = 2,
  options?: { orientation?: 'portrait' | 'landscape'; format?: 'a4' | 'letter'; pdfWidth?: number; pdfHeight?: number }
): Promise<void> {
  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.cssText = 'position:absolute;left:-9999px;top:0;';
  document.body.appendChild(container);
  try {
    await ensureFontsAndRender();
    const { toPng } = await import('html-to-image');
    const dataUrl = await toPng(container, {
      quality: 1,
      pixelRatio,
      cacheBust: true,
    });

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
  } finally {
    if (container.parentNode) container.parentNode.removeChild(container);
  }
}
