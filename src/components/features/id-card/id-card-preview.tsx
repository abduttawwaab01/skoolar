'use client';

import React, { useRef, useCallback, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Printer, Loader2, RotateCw, Eye, EyeOff, XCircle, IdCard } from 'lucide-react';
import { useIDCardStore } from '@/store/id-card-store';
import { CARD_WIDTH_LANDSCAPE, CARD_HEIGHT_LANDSCAPE, CARD_WIDTH_PORTRAIT, CARD_HEIGHT_PORTRAIT } from '@/lib/id-card-utils/types';
import { toast } from 'sonner';

const MM_TO_PX = 3.779527559;

export function IDCardPreview({ previewHtml, loading }: { previewHtml?: string | null; loading?: boolean }) {
  const { design, previewSide, setPreviewSide } = useIDCardStore();
  const cardRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(false);
  const [scale, setScale] = useState(1);

  const isLand = design.orientation === 'landscape';
  const cardW = isLand ? CARD_WIDTH_LANDSCAPE : CARD_WIDTH_PORTRAIT;
  const cardH = isLand ? CARD_HEIGHT_LANDSCAPE : CARD_HEIGHT_PORTRAIT;
  const cardWPx = cardW * MM_TO_PX;
  const cardHPx = cardH * MM_TO_PX;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width ?? 600;
      const s = Math.min((w - 32) / cardWPx, 1.8);
      setScale(Math.max(0.3, s));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [cardWPx]);

  async function captureCardAsDataUrl(): Promise<string> {
    if (!previewHtml) throw new Error('No preview HTML');
    const div = document.createElement('div');
    div.style.cssText = `position:absolute;left:-9999px;top:0;width:${cardWPx}px;height:${cardHPx}px;`;
    div.innerHTML = previewHtml;
    document.body.appendChild(div);
    try {
      const card = div.querySelector<HTMLElement>('.card');
      if (!card) throw new Error('Card element not found');

      // Use explicit pixel dimensions instead of mm for reliable capture
      const origW = card.style.width;
      const origH = card.style.height;
      card.style.width = `${cardWPx}px`;
      card.style.height = `${cardHPx}px`;

      // Wait for fonts
      await document.fonts.ready;

      // Wait for all images inside the card to load
      const imgs = Array.from(div.querySelectorAll('img'));
      await Promise.all(imgs.map(img =>
        img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })
      ));

      await new Promise(r => requestAnimationFrame(r));

      if (card.offsetWidth === 0 || card.offsetHeight === 0) {
        throw new Error('Card has zero dimensions');
      }

      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(card, {
        quality: 1,
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: '#ffffff',
      });

      card.style.width = origW;
      card.style.height = origH;

      return dataUrl;
    } finally {
      if (div.parentNode) div.parentNode.removeChild(div);
    }
  }

  const handleExportPNG = useCallback(async () => {
    setExporting(true);
    try {
      const dataUrl = await captureCardAsDataUrl();
      const link = document.createElement('a');
      link.download = `ID-Card-${design.type}-${previewSide}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      setError(true);
      toast.error('PNG export failed');
    } finally {
      setExporting(false);
    }
  }, [previewHtml, design.type, previewSide, cardWPx, cardHPx]);

  const handleExportPDF = useCallback(async () => {
    setExporting(true);
    try {
      const isLand = design.orientation === 'landscape';
      const cw = isLand ? 85.6 : 53.98;
      const ch = isLand ? 53.98 : 85.6;
      const dataUrl = await captureCardAsDataUrl();
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: isLand ? 'landscape' : 'portrait', unit: 'mm', format: [cw + 4, ch + 4] });
      doc.addImage(dataUrl, 'PNG', 2, 2, cw, ch, undefined, 'FAST');
      doc.save(`ID-Card-${design.type}-${previewSide}.pdf`);
    } catch {
      setError(true);
      toast.error('PDF export failed');
    } finally {
      setExporting(false);
    }
  }, [previewHtml, design.type, previewSide, design.orientation, cardWPx, cardHPx]);

  const handlePrint = useCallback(() => {
    if (!previewHtml) return;
    const isLand = design.orientation === 'landscape';
    const cw = isLand ? 85.6 : 53.98;
    const ch = isLand ? 53.98 : 85.6;
    const printWin = window.open('', '_blank');
    if (!printWin) return;
    printWin.document.write(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>ID Card Print</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Inter', system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; padding: 20px; background: #f1f5f9; }
.page { break-after: page; margin-bottom: 20px; }
.card-wrap { width: ${cw}mm; height: ${ch}mm; overflow: hidden; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
.label { font-size: 10px; font-weight: 600; color: #64748b; text-transform: uppercase; margin-bottom: 8px; }
@media print {
  @page { margin: 10mm; }
  body { padding: 0; background: #fff; }
  .label { display: none; }
  .card-wrap { box-shadow: none; }
  .page { margin-bottom: 0; }
}
</style>
</head>
<body>
<div class="page"><div class="label">${previewSide === 'front' ? 'Front' : 'Back'}</div><div class="card-wrap">${previewHtml}</div></div>
</body>
</html>`);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => printWin.print(), 500);
  }, [previewHtml, design.orientation, previewSide]);

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-[800px] mx-auto">
      <div className="flex flex-wrap items-center justify-center gap-3 w-full">
        <Button
          variant={previewSide === 'front' ? 'default' : 'outline'}
          size="sm" onClick={() => setPreviewSide('front')}
          className="h-9 text-xs px-5 font-medium"
        >
          <Eye className="size-3.5 mr-1.5" /> Front View
        </Button>
        <Button
          variant={previewSide === 'back' ? 'default' : 'outline'}
          size="sm" onClick={() => setPreviewSide('back')}
          className="h-9 text-xs px-5 font-medium"
        >
          <EyeOff className="size-3.5 mr-1.5" /> Back View
        </Button>
        <div className="w-px h-5 bg-border mx-1 hidden sm:block" />
        <Button size="sm" variant="outline" className="h-9 text-xs px-5 font-medium" onClick={handleExportPNG} disabled={exporting || loading}>
          {exporting ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <Download className="size-3.5 mr-1.5" />}
          Download PNG
        </Button>
        <Button size="sm" variant="outline" className="h-9 text-xs px-5 font-medium" onClick={handleExportPDF} disabled={exporting || loading}>
          <Download className="size-3.5 mr-1.5" /> Download PDF
        </Button>
        <Button size="sm" variant="outline" className="h-9 text-xs px-5 font-medium" onClick={handlePrint}>
          <Printer className="size-3.5 mr-1.5" /> Print
        </Button>
      </div>

      <div ref={containerRef} className="relative w-full flex items-center justify-center min-h-[400px] bg-gray-50/50 rounded-xl p-6 border border-gray-100">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 rounded-xl">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="size-8 animate-spin text-indigo-600" />
              <p className="text-sm font-medium text-gray-700">Generating preview...</p>
            </div>
          </div>
        )}
        {error ? (
          <div className="flex items-center justify-center bg-red-50 rounded-xl w-full max-w-[500px] mx-auto aspect-[85.6/53.98] p-6 border border-red-200">
            <div className="text-center">
              <div className="size-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
                <XCircle className="size-6 text-red-600" />
              </div>
              <p className="text-sm font-medium text-red-700 mb-2">Preview Failed</p>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setError(false)}>
                <RotateCw className="size-3.5 mr-1.5" /> Retry
              </Button>
            </div>
          </div>
        ) : previewHtml ? (
          <div
            ref={cardRef}
            className="flex items-center justify-center"
            style={{ height: cardHPx * scale + 4 }}
          >
            <div
              className="card-wrapper overflow-hidden shadow-2xl transition-all duration-300"
              style={{
                width: cardWPx,
                height: cardHPx,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                borderRadius: '4px',
                border: '1px solid rgba(0,0,0,0.06)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
              }}
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        ) : (
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center text-gray-500 rounded-xl w-full max-w-[500px] mx-auto aspect-[85.6/53.98] p-8 border-2 border-dashed border-gray-300">
            <div className="size-16 rounded-full bg-gray-200 flex items-center justify-center mb-4">
              <IdCard className="size-8 text-gray-400" />
            </div>
            <p className="text-base font-medium mb-2">No Preview Available</p>
            <p className="text-sm text-gray-500 text-center max-w-xs">Configure your design settings to see a live preview</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between w-full max-w-[500px] mx-auto text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <div className={`size-2 rounded-full ${isLand ? 'bg-blue-500' : 'bg-purple-500'}`} />
            {isLand ? 'Landscape' : 'Portrait'}
          </span>
          <span className="flex items-center gap-1">
            <div className="size-2 rounded-full bg-green-500" />
            {cardW} &times; {cardH} mm
          </span>
          <span className="flex items-center gap-1 text-gray-400">
            <div className="size-2 rounded-full bg-gray-400" />
            {Math.round(scale * 100)}%
          </span>
        </div>
        <div className="text-xs text-gray-400">
          {previewSide === 'front' ? 'Front' : 'Back'} view
        </div>
      </div>
    </div>
  );
}
