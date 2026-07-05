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
    backgroundColor: '#ffffff',
  });
  downloadDataUrl(dataUrl, `${filename}.png`);
}

export async function captureElementAsPDF(
  element: HTMLElement,
  filename = 'export',
  pixelRatio = 2,
  options?: { orientation?: 'portrait' | 'landscape'; format?: 'a4' | 'letter'; pdfWidth?: number; pdfHeight?: number }
): Promise<void> {
  await ensureFontsAndRender();
  const { toPng } = await import('html-to-image');
  const dataUrl = await toPng(element, {
    quality: 1,
    pixelRatio,
    cacheBust: true,
    backgroundColor: '#ffffff',
  });
  const { default: jsPDF } = await import('jspdf');
  const orient = options?.orientation ?? 'portrait';
  const hasCustomSize = options?.pdfWidth && options?.pdfHeight;
  const format = hasCustomSize ? [options.pdfWidth!, options.pdfHeight!] : (options?.format ?? 'a4');
  const pdf = new jsPDF({ orientation: orient, unit: 'mm', format });
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  pdf.addImage(dataUrl, 'PNG', 0, 0, pw, ph, undefined, 'FAST');
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
      backgroundColor: '#ffffff',
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
      backgroundColor: '#ffffff',
    });
    const { default: jsPDF } = await import('jspdf');
    const orient = options?.orientation ?? 'portrait';
    const hasCustomSize = options?.pdfWidth && options?.pdfHeight;
    const format = hasCustomSize ? [options.pdfWidth!, options.pdfHeight!] : (options?.format ?? 'a4');
    const pdf = new jsPDF({ orientation: orient, unit: 'mm', format });
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();
    pdf.addImage(dataUrl, 'PNG', 0, 0, pw, ph, undefined, 'FAST');
    pdf.save(`${filename}.pdf`);
  } finally {
    if (container.parentNode) container.parentNode.removeChild(container);
  }
}
