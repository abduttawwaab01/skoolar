export async function exportSpellingAsPNG(element: HTMLElement, filename = 'spelling-sheet'): Promise<void> {
  try {
    const { toPng } = await import('html-to-image');
    const dataUrl = await toPng(element, { quality: 1, pixelRatio: 2, backgroundColor: '#ffffff' });
    const link = document.createElement('a');
    link.download = `${filename}.png`;
    link.href = dataUrl;
    link.click();
  } catch (err) { console.error('PNG export failed:', err); throw err; }
}

export async function exportSpellingAsPDF(element: HTMLElement, filename = 'spelling-sheet', paperSize: 'a4' | 'letter' = 'a4'): Promise<void> {
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
      const dataUrl = await toPng(element, { quality: 1, pixelRatio: 2, backgroundColor: '#ffffff' });

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
  } catch (err) { console.error('PDF export failed:', err); throw err; }
}

export function printSpelling(html: string): void {
  const win = window.open('', '_blank');
  if (!win) { alert('Please allow popups to print.'); return; }
  win.document.write(html);
  win.document.close();
  win.onload = () => { setTimeout(() => win.print(), 300); };
}
