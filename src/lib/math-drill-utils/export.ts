export async function exportMathDrillAsPNG(element: HTMLElement, filename = 'math-drill-sheet'): Promise<void> {
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

export async function exportMathDrillAsPDF(element: HTMLElement, filename = 'math-drill-sheet', paperSize: 'a4' | 'letter' = 'a4'): Promise<void> {
  try {
    const { toPng } = await import('html-to-image');
    const dataUrl = await toPng(element, {
      quality: 1,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
    });
    const { default: jsPDF } = await import('jspdf');
    const isA4 = paperSize === 'a4';
    const pdf = new jsPDF('p', 'mm', isA4 ? 'a4' : 'letter');
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();
    pdf.addImage(dataUrl, 'PNG', 0, 0, pw, ph, undefined, 'FAST');
    pdf.save(`${filename}.pdf`);
  } catch (err) {
    console.error('PDF export failed:', err);
    throw err;
  }
}

export function printMathDrill(html: string): void {
  const win = window.open('', '_blank');
  if (!win) {
    alert('Please allow popups to print.');
    return;
  }
  win.document.write(html);
  win.document.close();
  win.onload = () => { setTimeout(() => win.print(), 300); };
}
