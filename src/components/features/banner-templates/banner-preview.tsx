'use client';

import { useRef, useEffect, useState } from 'react';
import { useBannerTemplatesStore } from '@/store/banner-templates-store';
import { renderBannerHTML } from '@/lib/banner-templates/render-banner';
import { getSizeDimensions } from '@/lib/banner-templates/types';
import { captureHTMLInIframe } from '@/lib/capture-utils';
import { Download, FileImage, Printer, Loader2, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function BannerPreview() {
  const { design, preview, setPreview } = useBannerTemplatesStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [captureLoading, setCaptureLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { width: bannerW, height: bannerH } = getSizeDimensions(design.size, design.customWidth, design.customHeight);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      try {
        const html = renderBannerHTML(design);
        setPreview({ html, loading: false });
      } catch {
        setPreview({ html: null, loading: false });
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [design, setPreview]);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const containerW = entries[0]?.contentRect?.width ?? 500;
      const padding = 32;
      const maxW = containerW - padding;
      const maxH = 500;
      const s = Math.min(maxW / bannerW, maxH / bannerH, 1);
      setScale(Math.max(0.1, s));
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [bannerW, bannerH]);

  const handleDownloadPNG = async () => {
    if (!preview.html) return;
    setCaptureLoading(true);
    try {
      const dataUrl = await captureHTMLInIframe(preview.html, 2);
      const link = document.createElement('a');
      link.download = `${design.name || 'banner'}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('PNG downloaded!');
    } catch {
      toast.error('Failed to export PNG');
    } finally {
      setCaptureLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!preview.html) return;
    setCaptureLoading(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const dataUrl = await captureHTMLInIframe(preview.html, 2);
      const orient = bannerW > bannerH ? 'landscape' : 'portrait';
      const pdf = new jsPDF({ orientation: orient, unit: 'px', format: [bannerW, bannerH] });
      pdf.addImage(dataUrl, 'PNG', 0, 0, bannerW, bannerH);
      pdf.save(`${design.name || 'banner'}.pdf`);
      toast.success('PDF downloaded!');
    } catch {
      toast.error('Failed to export PDF');
    } finally {
      setCaptureLoading(false);
    }
  };

  const handlePrint = () => {
    if (!preview.html) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(preview.html);
    w.document.close();
    w.onload = () => setTimeout(() => w.print(), 300);
  };

  const handleFullscreen = () => {
    if (!preview.html) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(preview.html);
    w.document.close();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <FileImage className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{bannerW} × {bannerH}px</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={handleFullscreen}
            title="Preview full size"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={handlePrint} title="Print">
            <Printer className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={handleDownloadPNG}
            disabled={captureLoading}
            title="Download PNG"
          >
            {captureLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="default"
            size="sm"
            className="h-7 px-2"
            onClick={handleDownloadPDF}
            disabled={captureLoading}
          >
            PDF
          </Button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center overflow-auto bg-muted/10 p-4"
      >
        {preview.html ? (
          <div
            style={{
              width: bannerW,
              height: bannerH,
              transform: `scale(${scale})`,
              transformOrigin: 'center center',
            }}
          >
            <iframe
              srcDoc={preview.html}
              style={{ width: '100%', height: '100%', border: 'none', pointerEvents: 'none' }}
              sandbox="allow-same-origin"
              title="Banner Preview"
            />
          </div>
        ) : (
          <div className="text-center text-muted-foreground">
            <FileImage className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Preview will appear here</p>
          </div>
        )}
      </div>
      <div className="px-3 py-1.5 border-t bg-muted/20 text-center">
        <span className="text-[10px] text-muted-foreground">
          {Math.round(scale * 100)}% scale · {design.backgroundStyle} background
        </span>
      </div>
    </div>
  );
}
