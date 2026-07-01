'use client';

import { useRef, useCallback, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Loader2, Download, Printer, Image as ImageIcon, FileText, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { useCertificateStore } from '@/store/certificate-store';
import { exportAsPNG, exportAsPDF } from '@/lib/certificate-utils/export';

export function CertificatePreview() {
  const previewRef = useRef<HTMLDivElement>(null);
  const { preview, design } = useCertificateStore();
  const [exporting, setExporting] = useState<'png' | 'pdf' | null>(null);

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
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <ZoomOut className="h-4 w-4 text-muted-foreground" />
          <Slider
            value={[preview.zoom]}
            onValueChange={([v]) => useCertificateStore.getState().setPreview({ zoom: v })}
            min={25}
            max={200}
            step={5}
            className="w-28"
          />
          <ZoomIn className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground w-10">{preview.zoom}%</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={handleExportPNG} disabled={exporting === 'png' || !preview.html}>
            {exporting === 'png' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
            <span className="ml-1 hidden sm:inline">PNG</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={handleExportPDF} disabled={exporting === 'pdf' || !preview.html}>
            {exporting === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            <span className="ml-1 hidden sm:inline">PDF</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={handlePrint} disabled={!preview.html}>
            <Printer className="h-4 w-4" />
            <span className="ml-1 hidden sm:inline">Print</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => useCertificateStore.getState().setPreview({ zoom: 100 })}>
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div ref={previewRef} className="flex-1 overflow-auto bg-muted/50 p-4">
        {preview.loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : preview.html ? (
          <div
            className="cert-preview-frame mx-auto"
            style={{
              transform: `scale(${preview.zoom / 100})`,
              transformOrigin: 'top center',
              width: design.orientation === 'portrait' ? '210mm' : '297mm',
            }}
          >
            <div dangerouslySetInnerHTML={{ __html: preview.html }} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <FileText className="h-16 w-16 mb-4 opacity-20" />
            <p className="text-lg font-medium">No Preview</p>
            <p className="text-sm">Adjust the design settings to see a live preview</p>
          </div>
        )}
      </div>
    </Card>
  );
}
