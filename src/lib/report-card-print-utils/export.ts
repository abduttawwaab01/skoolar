export async function exportReportCardPrintAsPNG(element: HTMLElement, filename = 'report-card'): Promise<void> {
  try {
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
  } catch (err) {
    console.error('PNG export failed:', err);
    throw err;
  }
}

export async function exportReportCardPrintAsPDF(element: HTMLElement, filename = 'report-card', paperSize: 'a4' | 'letter' = 'a4'): Promise<void> {
  try {
    const { toPng } = await import('html-to-image');
    const { default: jsPDF } = await import('jspdf');
    const isA4 = paperSize === 'a4';
    const pdf = new jsPDF('p', 'mm', isA4 ? 'a4' : 'letter');
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();

    const targetCssW = Math.round((pw / 25.4) * 96);
    const origWidth = element.style.width;
    const origMaxWidth = element.style.maxWidth;
    const origOverflow = element.style.overflow;
    element.style.width = `${targetCssW}px`;
    element.style.maxWidth = 'none';
    element.style.overflow = 'visible';
    await new Promise(r => requestAnimationFrame(r));

    try {
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
      const pageContentH = ph;
      const totalPages = Math.max(1, Math.ceil(mmH / pageContentH));

      for (let i = 0; i < totalPages; i++) {
        if (i > 0) pdf.addPage();

        if (totalPages === 1 && mmH <= pageContentH) {
          const scale = Math.min(pw / mmW, ph / mmH);
          const finalW = mmW * scale;
          const finalH = mmH * scale;
          pdf.addImage(dataUrl, 'PNG', (pw - finalW) / 2, (ph - finalH) / 2, finalW, finalH, undefined, 'FAST');
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

          const scale = pw / mmW;
          const h = srcH * (25.4 / 96) * scale / 2;
          pdf.addImage(pageDataUrl, 'PNG', 0, 0, pw, h, undefined, 'FAST');
        }
      }
    } finally {
      element.style.width = origWidth;
      element.style.maxWidth = origMaxWidth;
      element.style.overflow = origOverflow;
    }

    pdf.save(`${filename}.pdf`);
  } catch (err) {
    console.error('PDF export failed:', err);
    throw err;
  }
}

export function printReportCard(html: string): void {
  const win = window.open('', '_blank');
  if (!win) {
    alert('Please allow popups to print.');
    return;
  }
  win.document.write(html);
  win.document.close();
  win.onload = () => { setTimeout(() => win.print(), 300); };
}

export async function exportBulkReportCardAsPDF(allHtml: string, filename = 'report-cards'): Promise<void> {
  try {
    const { default: jsPDF } = await import('jspdf');

    const blob = new Blob([allHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const tempIframe = document.createElement('iframe');
    tempIframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:210mm;height:297mm;border:none';
    document.body.appendChild(tempIframe);
    tempIframe.src = url;

    await new Promise<void>((resolve, reject) => {
      tempIframe.onload = () => resolve();
      tempIframe.onerror = reject;
    });

    const doc = tempIframe.contentDocument || tempIframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(tempIframe);
      URL.revokeObjectURL(url);
      throw new Error('Could not access iframe document');
    }

    doc.body.style.background = '#ffffff';
    doc.documentElement.style.background = '#ffffff';

    const pages = doc.querySelectorAll('.report-card-page');
    const totalPages = pages.length;

    if (totalPages === 0) {
      document.body.removeChild(tempIframe);
      URL.revokeObjectURL(url);
      throw new Error('No report card pages found');
    }

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();

    const targetCssW = Math.round((pw / 25.4) * 96);

    for (let i = 0; i < totalPages; i++) {
      if (i > 0) pdf.addPage();

      const pageEl = pages[i] as HTMLElement;
      const origWidth = pageEl.style.width;
      const origMaxWidth = pageEl.style.maxWidth;
      const origOverflow = pageEl.style.overflow;

      pageEl.style.width = `${targetCssW}px`;
      pageEl.style.maxWidth = 'none';
      pageEl.style.overflow = 'visible';

      await new Promise(r => requestAnimationFrame(r));

      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(pageEl, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });

      pageEl.style.width = origWidth;
      pageEl.style.maxWidth = origMaxWidth;
      pageEl.style.overflow = origOverflow;

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

      const scale = Math.min(pw / mmW, ph / mmH);
      const finalW = mmW * scale;
      const finalH = mmH * scale;
      pdf.addImage(dataUrl, 'PNG', (pw - finalW) / 2, (ph - finalH) / 2, finalW, finalH, undefined, 'FAST');
    }

    document.body.removeChild(tempIframe);
    URL.revokeObjectURL(url);

    pdf.save(`${filename}.pdf`);
  } catch (err) {
    console.error('Bulk PDF export failed:', err);
    throw err;
  }
}
