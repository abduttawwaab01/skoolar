import type { IDCardPreviewData } from './types';
import { renderIDCardPreview, renderIDCardBack } from './render-card';

export async function exportIDCardAsHTML(
  data: IDCardPreviewData,
  side: 'front' | 'back' = 'front'
): Promise<string> {
  return side === 'front' ? renderIDCardPreview(data) : renderIDCardBack(data);
}

export async function exportIDCardAsCombinedHTML(data: IDCardPreviewData): Promise<string> {
  const frontHTML = await renderIDCardPreview(data);
  const backHTML = await renderIDCardBack(data);
  const isLand = (data.design.orientation || 'landscape') === 'landscape';
  const cw = isLand ? 85.6 : 53.98;
  const ch = isLand ? 53.98 : 85.6;
  
  const frontHTMLclean = frontHTML.replace(/<!DOCTYPE html>[\s\S]*?<body>/, '<div class="card-embed">').replace(/<\/body>[\s\S]*?<\/html>/, '<\/div>');
  const backHTMLclean = backHTML.replace(/<!DOCTYPE html>[\s\S]*?<body>/, '<div class="card-embed">').replace(/<\/body>[\s\S]*?<\/html>/, '<\/div>');
  
  const fullFrontPage = `
<div class="card-page">
  <div class="page-label">Front</div>
  <div class="card-wrap">${frontHTMLclean}</div>
</div>`;
  
  const fullBackPage = `
<div class="card-page">
  <div class="page-label">Back</div>
  <div class="card-wrap">${backHTMLclean}</div>
</div>`;
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ID Card - ${data.student?.name || data.teacher?.name || 'Card'}</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  display: flex; flex-direction: column; align-items: center;
  padding: 20px; background: #f1f5f9;
}
.print-container {
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  margin-bottom: 20px;
}
.page-label {
  font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase;
}
.card-wrap { width: ${cw}mm; height: ${ch}mm; border-radius: 6px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
.page { page-break-after: always; margin-bottom: 15px; }
.page:last-child { page-break-after: avoid; }
@media print {
  @page { margin: 10mm; }
  body { padding: 0; background: #fff; }
  .page-label { display: none; }
  .page { margin-bottom: 0; box-shadow: none; }
}
</style>
</head>
<body>
<div class="page">
  <div class="page-label">Front</div>
  <div class="card-wrap">${frontHTMLclean}</div>
</div>
<div class="page">
  <div class="page-label">Back</div>
  <div class="card-wrap">${backHTMLclean}</div>
</div>
<script>window.print();</script>
</body>
</html>`;
}

export function generateIDCardBatchHTML(cards: { frontHTML: string; backHTML: string; name: string }[], orientation: 'landscape' | 'portrait' = 'landscape'): string {
  const isLand = orientation === 'landscape';
  const cw = isLand ? 85.6 : 53.98;
  const ch = isLand ? 53.98 : 85.6;
  const perRow = 4;
  const rows = Math.ceil(cards.length / perRow);
  let gridRows = '';
  for (let r = 0; r < rows; r++) {
    let rowCells = '';
    for (let c = 0; c < perRow; c++) {
      const idx = r * perRow + c;
      if (idx >= cards.length) {
        rowCells += '<div class="card-cell empty"></div>';
      } else {
        const card = cards[idx];
        rowCells += `<div class="card-cell"><div class="card-label">${card.name}</div><div class="card-inner card-front"><div class="card-label">Front</div><div class="card-content-wrapper">
${card.frontHTML}</div></div><div class="card-back" style="display:none;"><div class="card-label">Back</div><div class="card-content-wrapper">
${card.backHTML}</div></div></div>`;
      }
    }
    gridRows += `<div class="card-row">${rowCells}</div>`;
  }
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>ID Cards Batch</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: system-ui, sans-serif; padding: 10mm; background: #fff; }
.card-row { display: flex; gap: 5mm; margin-bottom: 5mm; }
.card-cell { width: ${cw}mm; height: ${ch}mm; border-radius: 3px; overflow: hidden; position: relative; background: #fff; box-shadow: 0 2px 6px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }
.card-cell.empty { background: #f8fafc; }
.card-label { position: absolute; top: 2px; left: 2px; font-size: 6pt; color: #94a3b8; z-index: 10; }
.card-inner { width: 100%; height: 100%; position: relative; }
.card-front { position: relative; height: ${ch * 0.75}mm; overflow: hidden; }
.card-back { position: relative; height: ${ch * 0.25}mm; overflow: hidden; background: #f8fafc; border-top: 1px dashed #cbd5e1; }
.card-label { position: absolute; top: 1px; left: 1px; font-size: 5pt; color: #94a3b8; z-index: 10; }
.card-content-wrapper { position: absolute; inset: 0; padding: 3px; }
.card-back .card-label { background: #f1f5f9; padding: 0 3px; border-radius: 2px; }
.card-content-wrapper {
  transform-origin: top left;
  width: ${cw}mm;
  height: ${ch}mm;
}
@media print {
  .card-back { display: none !important; }
  .card-cell { border: 1px solid #000; }
}
</style>
</head>
<body>${gridRows}</body>
</html>`;
}
