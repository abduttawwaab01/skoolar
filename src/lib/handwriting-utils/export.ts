export async function exportHandwritingAsPNG(element: HTMLElement, filename = 'handwriting-sheet'): Promise<void> {
  const { toPng } = await import('html-to-image');
  const dataUrl = await toPng(element, { quality: 1, pixelRatio: 2, backgroundColor: '#ffffff' });
  const link = document.createElement('a');
  link.download = `${filename}.png`;
  link.href = dataUrl;
  link.click();
}

export async function exportHandwritingAsPDF(element: HTMLElement, filename = 'handwriting-sheet', paperSize: 'a4' | 'letter' = 'a4'): Promise<void> {
  const { toPng } = await import('html-to-image');
  const dataUrl = await toPng(element, { quality: 1, pixelRatio: 2, backgroundColor: '#ffffff' });
  const { default: jsPDF } = await import('jspdf');
  const isA4 = paperSize === 'a4';
  const pdf = new jsPDF('p', 'mm', isA4 ? 'a4' : 'letter');
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  pdf.addImage(dataUrl, 'PNG', 0, 0, pw, ph, undefined, 'FAST');
  pdf.save(`${filename}.pdf`);
}

export function printHandwriting(html: string): void {
  const win = window.open('', '_blank');
  if (!win) { alert('Please allow popups to print.'); return; }
  win.document.write(html);
  win.document.close();
  win.onload = () => { setTimeout(() => win.print(), 300); };
}
