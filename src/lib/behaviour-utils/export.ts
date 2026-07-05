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

function withCleanLayout(body: HTMLElement, element: HTMLElement, targetCssW: number, fn: () => Promise<void>): Promise<void> {
  const origBodyPadding = body.style.padding;
  const origBodyMargin = body.style.margin;
  const origEl = prepareElementForCapture(element, targetCssW);
  body.style.padding = '0';
  body.style.margin = '0';

  return new Promise((resolve, reject) => {
    requestAnimationFrame(async () => {
      try {
        await fn();
        resolve();
      } catch (e) {
        reject(e);
      } finally {
        restoreElementStyles(element, origEl);
        body.style.padding = origBodyPadding;
        body.style.margin = origBodyMargin;
      }
    });
  });
}

export async function exportBehaviourAsPNG(element: HTMLElement, filename = 'behaviour-chart', body?: HTMLElement): Promise<void> {
  try {
    const targetCssW = Math.round((297 / 25.4) * 96);

    const doExport = async () => {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(element, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });
      const link = document.createElement('a');
      link.download = `${filename}.png`;
      link.href = dataUrl;
      link.click();
    };

    if (body) {
      await withCleanLayout(body, element, targetCssW, doExport);
    } else {
      const orig = prepareElementForCapture(element, targetCssW);
      await new Promise(r => requestAnimationFrame(r));
      try {
        await doExport();
      } finally {
        restoreElementStyles(element, orig);
      }
    }
  } catch (err) {
    console.error('PNG export failed:', err);
    throw err;
  }
}

export async function exportBehaviourAsPDF(element: HTMLElement, filename = 'behaviour-chart', body?: HTMLElement): Promise<void> {
  try {
    const { default: jsPDF } = await import('jspdf');

    const pdf = new jsPDF('l', 'mm', 'a4');
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();

    const targetCssW = Math.round((pdfW / 25.4) * 96);

    const doExport = async () => {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(element, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });

      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = dataUrl;
      });

      const imgW = img.naturalWidth;
      const imgH = img.naturalHeight;
      const cssW = imgW / 2;
      const cssH = imgH / 2;
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
          const h = srcH * (25.4 / 96) * scale / 2;
          pdf.addImage(pageDataUrl, 'PNG', 0, 0, pdfW, h, undefined, 'FAST');
        }
      }
    };

    if (body) {
      await withCleanLayout(body, element, targetCssW, doExport);
    } else {
      const orig = prepareElementForCapture(element, targetCssW);
      await new Promise(r => requestAnimationFrame(r));
      try {
        await doExport();
      } finally {
        restoreElementStyles(element, orig);
      }
    }

    pdf.save(`${filename}.pdf`);
  } catch (err) {
    console.error('PDF export failed:', err);
    throw err;
  }
}

export function exportBehaviourAsPrint(html: string): void {
  const win = window.open('', '_blank');
  if (!win) {
    alert('Please allow popups to print.');
    return;
  }
  win.document.write(html);
  win.document.close();
  win.onload = () => { setTimeout(() => win.print(), 300); };
}
