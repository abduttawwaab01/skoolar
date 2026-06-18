'use client';

import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

interface IDCardPrintProps {
  cards: Array<{
    id: string;
    name: string;
    frontHtml?: string;
    backHtml?: string;
  }>;
}

const CARD_W = 85.6;
const CARD_H = 53.98;

export function IDCardPrint({ cards }: IDCardPrintProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Print ID Cards</title>
<style>
@page { size: A4; margin: 10mm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: system-ui, sans-serif; background: #fff; }
.page { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; page-break-after: always; }
.card-cell { width: ${CARD_W}mm; height: ${CARD_H}mm; position: relative; }
.card-name { position: absolute; top: -3mm; left: 0; font-size: 7pt; color: #94a3b8; }
@media print { .page { page-break-after: always; } }
</style>
</head>
<body>`;

    for (let i = 0; i < cards.length; i += 4) {
      html += '<div class="page">';
      for (let j = 0; j < 4; j++) {
        const card = cards[i + j];
        if (card) {
          html += `<div class="card-cell"><div class="card-name">${card.name}</div>${card.frontHtml || ''}</div>`;
        } else {
          html += '<div class="card-cell"></div>';
        }
      }
      html += '</div>';
    }

    html += '</body></html>';
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  if (!cards.length) return null;

  return (
    <Button onClick={handlePrint} variant="outline" size="sm" className="h-8 text-xs">
      <Printer className="size-3.5 mr-1" /> Print {cards.length} Cards
    </Button>
  );
}
