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
.card-wrap { border-radius: 6px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
@media print {
  @page { margin: 0; }
  body { padding: 0; background: #fff; }
  .page-label { display: none; }
}
</style>
</head>
<body>
<div class="print-container">
  <div class="page-label">Front</div>
  <div class="card-wrap">${frontHTML.replace(/<!DOCTYPE html>[\s\S]*?<body>/, '<div class="card-embed">').replace(/<\/body>[\s\S]*?<\/html>/, '</div>')}</div>
</div>
<div class="print-container">
  <div class="page-label">Back</div>
  <div class="card-wrap">${backHTML.replace(/<!DOCTYPE html>[\s\S]*?<body>/, '<div class="card-embed">').replace(/<\/body>[\s\S]*?<\/html>/, '</div>')}</div>
</div>
<script>window.print();</script>
</body>
</html>`;
}

export function generateIDCardBatchHTML(cards: { frontHTML: string; backHTML: string; name: string }[]): string {
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
        rowCells += `<div class="card-cell"><div class="card-label">${card.name}</div><div class="card-inner">${card.frontHTML}</div></div>`;
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
.card-cell { width: 85.6mm; height: 53.98mm; border-radius: 3px; overflow: hidden; position: relative; }
.card-cell.empty { background: #f8fafc; }
.card-label { position: absolute; top: 2px; left: 2px; font-size: 6pt; color: #94a3b8; z-index: 10; }
.card-inner { width: 100%; height: 100%; }
.card-inner iframe { width: 100%; height: 100%; border: none; }
@media print { @page { margin: 5mm; } }
</style>
</head>
<body>${gridRows}</body>
</html>`;
}
