'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useBehaviourStore } from '@/store/behaviour-store';
import { renderChartHTML } from '@/lib/behaviour-utils/render-chart';
import { exportBehaviourAsPNG, exportBehaviourAsPDF, exportBehaviourAsPrint } from '@/lib/behaviour-utils/export';
import { Download, Printer, FileImage, FileText } from 'lucide-react';

export function BehaviourPreview() {
  const { config } = useBehaviourStore();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(75);
  const htmlContent = useMemo(() => renderChartHTML(config), [config]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !htmlContent) return;
    iframe.srcdoc = htmlContent;
  }, [htmlContent]);

  const handleExportPNG = useCallback(async () => {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument?.body) return;
    try {
      const el = iframe.contentDocument.body.firstElementChild as HTMLElement;
      if (el) {
        await exportBehaviourAsPNG(el, config.chartTitle.replace(/\s+/g, '-').toLowerCase());
      }
    } catch (err) {
      console.error(err);
    }
  }, [config.chartTitle]);

  const handleExportPDF = useCallback(async () => {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument?.body) return;
    try {
      const el = iframe.contentDocument.body.firstElementChild as HTMLElement;
      if (el) {
        await exportBehaviourAsPDF(el, config.chartTitle.replace(/\s+/g, '-').toLowerCase());
      }
    } catch (err) {
      console.error(err);
    }
  }, [config.chartTitle]);

  const handlePrint = useCallback(() => {
    const html = renderChartHTML(config);
    exportBehaviourAsPrint(html);
  }, [config]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b bg-muted/20">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Zoom:</span>
          <input
            type="range"
            min={25}
            max={200}
            value={zoom}
            onChange={(e) => setZoom(parseInt(e.target.value))}
            className="w-24 h-1.5"
          />
          <span className="text-xs text-muted-foreground w-8">{zoom}%</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleExportPNG} className="btn-ghost text-xs" title="Export as PNG">
            <FileImage className="w-3.5 h-3.5 mr-1" />
            PNG
          </button>
          <button onClick={handleExportPDF} className="btn-ghost text-xs" title="Export as PDF">
            <FileText className="w-3.5 h-3.5 mr-1" />
            PDF
          </button>
          <button onClick={handlePrint} className="btn-ghost text-xs" title="Print">
            <Printer className="w-3.5 h-3.5 mr-1" />
            Print
          </button>
        </div>
      </div>

      {/* Preview area */}
      <div ref={containerRef} className="flex-1 overflow-auto p-4 bg-muted/20">
        <div
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
            width: zoom < 100 ? '100%' : `${100 / (zoom / 100)}%`,
          }}
          className="mx-auto shadow-lg rounded-lg overflow-hidden"
        >
          <iframe
            ref={iframeRef}
            title="Behaviour Chart Preview"
            className="w-full border-0 bg-white"
            style={{ minHeight: 500, height: 'auto' }}
            sandbox="allow-same-origin"
          />
        </div>
      </div>

      {/* Student count badge */}
      <div className="px-3 py-1.5 border-t text-[10px] text-muted-foreground bg-muted/10">
        {config.students.length} student{config.students.length !== 1 ? 's' : ''} · {config.categories.length} categor{config.categories.length === 1 ? 'y' : 'ies'} · {config.templateId.replace(/-/g, ' ')}
      </div>
    </div>
  );
}
