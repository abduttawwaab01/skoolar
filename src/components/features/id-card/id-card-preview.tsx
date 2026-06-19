'use client';

import React, { useRef, useCallback, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Printer, Loader2, RotateCw, Eye, EyeOff, XCircle, IdCard } from 'lucide-react';
import { useIDCardStore } from '@/store/id-card-store';
import { CARD_WIDTH_LANDSCAPE, CARD_HEIGHT_LANDSCAPE, CARD_WIDTH_PORTRAIT, CARD_HEIGHT_PORTRAIT } from '@/lib/id-card-utils/types';

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

  const handleExportPNG = useCallback(async () => {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      const { toPng } = await import('html-to-image');
      const cardEl = cardRef.current.querySelector('.card-wrapper') as HTMLElement;
      const target = cardEl || cardRef.current;
      const dataUrl = await toPng(target, { quality: 1, pixelRatio: 4, cacheBust: true });
      const link = document.createElement('a');
      link.download = `ID-Card-${design.type}-${previewSide}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      setError(true);
    } finally {
      setExporting(false);
    }
  }, [design.type, previewSide]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

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
