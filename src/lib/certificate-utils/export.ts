import { type CertificateDesignState, type Orientation } from './types';

export async function exportAsPNG(element: HTMLElement, filename: string = 'certificate'): Promise<void> {
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

export async function exportAsPDF(element: HTMLElement, filename: string = 'certificate', orientation: Orientation = 'portrait'): Promise<void> {
  try {
    const { toPng } = await import('html-to-image');
    const dataUrl = await toPng(element, {
      quality: 1,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
    });

    const { default: jsPDF } = await import('jspdf');

    const pdfOrientation = orientation === 'portrait' ? 'p' : 'l';
    const pdf = new jsPDF(pdfOrientation, 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

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

    const scale = Math.min(pdfWidth / mmW, pdfHeight / mmH);
    const finalW = mmW * scale;
    const finalH = mmH * scale;
    pdf.addImage(dataUrl, 'PNG', (pdfWidth - finalW) / 2, (pdfHeight - finalH) / 2, finalW, finalH, undefined, 'FAST');
    pdf.save(`${filename}.pdf`);
  } catch (err) {
    console.error('PDF export failed:', err);
    throw err;
  }
}

export function exportAsPrint(html: string): void {
  const win = window.open('', '_blank');
  if (!win) {
    alert('Please allow popups to print the certificate.');
    return;
  }
  win.document.write(html);
  win.document.close();
  win.onload = () => {
    setTimeout(() => {
      win.print();
    }, 300);
  };
}

export function downloadAsHTML(html: string, filename: string = 'certificate'): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = `${filename}.html`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

export function getFoilCSS(foilStyle: string): string {
  const foils: Record<string, string> = {
    gold: 'linear-gradient(135deg, #bf953f 0%, #fcf6ba 20%, #b38728 40%, #fbf5b7 60%, #aa771c 80%, #bf953f 100%)',
    silver: 'linear-gradient(135deg, #a8a8a8 0%, #f0f0f0 20%, #808080 40%, #e0e0e0 60%, #606060 80%, #a8a8a8 100%)',
    bronze: 'linear-gradient(135deg, #cd7f32 0%, #f8d5a3 20%, #a0522d 40%, #e8c48b 60%, #8b4513 80%, #cd7f32 100%)',
  };
  return foils[foilStyle] || '';
}

export function getFontImport(fontFamily: string): string {
  const fontImports: Record<string, string> = {
    '"Playfair Display", serif': '@import url("https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&display=swap");',
    '"Open Sans", sans-serif': '@import url("https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&display=swap");',
    '"Lato", sans-serif': '@import url("https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700;900&display=swap");',
    '"Montserrat", sans-serif': '@import url("https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;900&display=swap");',
    '"Great Vibes", cursive': '@import url("https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap");',
  };
  return fontImports[fontFamily] || '';
}
