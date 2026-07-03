'use client';

import { useRef, useCallback, useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Loader2, Download, Printer, Image as ImageIcon, FileText, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { useCertificateStore } from '@/store/certificate-store';
import { exportAsPNG, exportAsPDF } from '@/lib/certificate-utils/export';
import { useIsMobile } from '@/hooks/use-mobile';

export function CertificatePreview() {
  const previewRef = useRef<HTMLDivElement>(null);
  const { preview, design } = useCertificateStore();
  const isMobile = useIsMobile();
  const [exporting, setExporting] = useState<'png' | 'pdf' | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const nativeCertWidth = design.orientation === 'portrait' ? 210 : 297;
  const scale = isMobile && containerWidth > 0
    ? Math.min(preview.zoom / 100, containerWidth / nativeCertWidth)
    : preview.zoom / 100;

  const handleExportPNG = useCallback(async () => {
    if (!previewRef.current) return;
    setExporting('png');
    try {
      const el = previewRef.current.querySelector('.cert-preview-frame') as HTMLElement;
      if (el) await exportAsPNG(el, `certificate-${Date.now()}`);
    } finally {
      setExporting(null);
    }
  }, []);

  const handleExportPDF = useCallback(async () => {
    if (!previewRef.current) return;
    setExporting('pdf');
    try {
      const el = previewRef.current.querySelector('.cert-preview-frame') as HTMLElement;
      if (el) await exportAsPDF(el, `certificate-${Date.now()}`, design.orientation);
    } finally {
      setExporting(null);
    }
  }, [design.orientation]);

  const handlePrint = useCallback(() => {
    if (!preview.html) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(preview.html);
    win.document.close();
    win.onload = () => { setTimeout(() => win.print(), 300); };
  }, [preview.html]);

  return (
    <Card className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-2 sm:px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-1 sm:gap-2">
          <ZoomOut className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
          <Slider
            value={[preview.zoom]}
            onValueChange={([v]) => useCertificateStore.getState().setPreview({ zoom: v })}
            min={25}
            max={200}
            step={5}
            className="w-20 sm:w-28"
          />
          <ZoomIn className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
          <span className="text-[10px] sm:text-xs text-muted-foreground w-8 sm:w-10">{preview.zoom}%</span>
        </div>
        <div className="flex items-center gap-0.5 sm:gap-1">
          <Button variant="ghost" size="sm" onClick={handleExportPNG} disabled={exporting === 'png' || !preview.html} className="h-7 px-1.5 sm:px-2">
            {exporting === 'png' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleExportPDF} disabled={exporting === 'pdf' || !preview.html} className="h-7 px-1.5 sm:px-2">
            {exporting === 'pdf' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={handlePrint} disabled={!preview.html} className="h-7 px-1.5 sm:px-2">
            <Printer className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => useCertificateStore.getState().setPreview({ zoom: 100 })} className="h-7 px-1.5 sm:px-2">
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 overflow-auto bg-muted/50 p-2 sm:p-4">
        {preview.loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : preview.html ? (
          <div
            ref={previewRef}
            className="cert-preview-frame mx-auto"
            style={{
              transform: `scale(${scale})`,
              transformOrigin: 'top center',
              width: `${nativeCertWidth}mm`,
              maxWidth: isMobile ? `${containerWidth}px` : '100%',
            }}
          >
            <div
              dangerouslySetInnerHTML={{ __html: preview.html }}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <FileText className="h-12 w-12 sm:h-16 sm:w-16 mb-3 sm:mb-4 opacity-20" />
            <p className="text-base sm:text-lg font-medium">No Preview</p>
            <p className="text-xs sm:text-sm">Adjust the design settings to see a live preview</p>
          </div>
        )}
      </div>
    </Card>
  );
}
