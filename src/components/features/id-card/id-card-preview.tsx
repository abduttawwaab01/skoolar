'use client';

import React, { useRef, useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Download, Printer, Loader2, RotateCw } from 'lucide-react';
import { useIDCardStore } from '@/store/id-card-store';
import { CARD_WIDTH_LANDSCAPE, CARD_HEIGHT_LANDSCAPE, CARD_WIDTH_PORTRAIT, CARD_HEIGHT_PORTRAIT } from '@/lib/id-card-utils/types';

const PREVIEW_SCALE = 4.2;
const ROUNDED_MM = 3.5;

export function IDCardPreview({ previewHtml, loading }: { previewHtml?: string | null; loading?: boolean }) {
  const { design, previewSide, setPreviewSide } = useIDCardStore();
  const cardRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(false);

  const isLand = design.orientation === 'landscape';
  const cardW = isLand ? CARD_WIDTH_LANDSCAPE : CARD_WIDTH_PORTRAIT;
  const cardH = isLand ? CARD_HEIGHT_LANDSCAPE : CARD_HEIGHT_PORTRAIT;
  const pw = cardW * PREVIEW_SCALE;
  const ph = cardH * PREVIEW_SCALE;

  const handleExportPNG = useCallback(async () => {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(cardRef.current, { quality: 1, pixelRatio: 2, cacheBust: true });
      const link = document.createElement('a');
      link.download = `ID-Card-${design.type}-front.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      setError(true);
    } finally {
      setExporting(false);
    }
  }, [design.type]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-2">
        <Button
          variant={previewSide === 'front' ? 'default' : 'outline'}
          size="sm" onClick={() => setPreviewSide('front')}
          className="h-7 text-xs"
        >
          Front
        </Button>
        <Button
          variant={previewSide === 'back' ? 'default' : 'outline'}
          size="sm" onClick={() => setPreviewSide('back')}
          className="h-7 text-xs"
        >
          Back
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleExportPNG} disabled={exporting || loading}>
          {exporting ? <Loader2 className="size-3 animate-spin mr-1" /> : <Download className="size-3 mr-1" />}
          PNG
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handlePrint}>
          <Printer className="size-3 mr-1" /> Print
        </Button>
      </div>

      <div className="relative">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 rounded-lg">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        )}
        {error ? (
          <div className="flex items-center justify-center bg-muted rounded-lg" style={{ width: pw, height: ph }}>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Preview not available</p>
              <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={() => setError(false)}>
                <RotateCw className="size-3 mr-1" /> Retry
              </Button>
            </div>
          </div>
        ) : previewHtml ? (
          <div
            ref={cardRef}
            className="overflow-hidden shadow-2xl transition-all duration-300"
            style={{
              width: pw,
              height: ph,
              borderRadius: `${ROUNDED_MM * PREVIEW_SCALE}px`,
              border: '0.5px solid rgba(0,0,0,0.1)',
            }}
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        ) : (
          <div
            className="bg-muted flex items-center justify-center text-muted-foreground text-sm rounded-lg"
            style={{ width: pw, height: ph }}
          >
            Select a student to preview
          </div>
        )}
      </div>

      <div className="text-[10px] text-muted-foreground">
        {isLand ? 'Landscape' : 'Portrait'} &middot; {cardW} &times; {cardH} mm
      </div>
    </div>
  );
}
