export async function exportBehaviourAsPNG(element: HTMLElement, filename = 'behaviour-chart'): Promise<void> {
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

export async function exportBehaviourAsPDF(element: HTMLElement, filename = 'behaviour-chart'): Promise<void> {
  try {
    const { toPng } = await import('html-to-image');
    const dataUrl = await toPng(element, {
      quality: 1,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
    });
    const { default: jsPDF } = await import('jspdf');
    const pdf = new jsPDF('l', 'mm', 'a4');
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();
    pdf.addImage(dataUrl, 'PNG', 0, 0, pdfW, pdfH, undefined, 'FAST');
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
