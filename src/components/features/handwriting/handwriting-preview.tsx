'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useHandwritingStore } from '@/store/handwriting-store';
import { renderWorksheetHTML } from '@/lib/handwriting-utils/render-worksheet';
import { exportHandwritingAsPNG, exportHandwritingAsPDF, printHandwriting } from '@/lib/handwriting-utils/export';
import { FileImage, FileText, Printer } from 'lucide-react';

export function HandwritingPreview() {
  const { config } = useHandwritingStore();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [zoom, setZoom] = useState(75);
  const htmlContent = useMemo(() => renderWorksheetHTML(config), [config]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !htmlContent) return;
    iframe.srcdoc = htmlContent;
  }, [htmlContent]);

  const captureFromHTML = useCallback(async (
    exportFn: (el: HTMLElement, filename: string, ...args: any[]) => Promise<void>,
    filename: string,
    ...args: any[]
  ) => {
    if (!htmlContent) return;
    const tempDiv = document.createElement('div');
    tempDiv.style.cssText = 'position:absolute;left:-9999px;top:0;';
    tempDiv.innerHTML = htmlContent;
    document.body.appendChild(tempDiv);
    try {
      await document.fonts.ready;
      await new Promise(r => requestAnimationFrame(r));
      await exportFn(tempDiv, filename, ...args);
    } finally {
      document.body.removeChild(tempDiv);
    }
  }, [htmlContent]);

  const handlePNG = useCallback(async () => {
    await captureFromHTML(exportHandwritingAsPNG, config.sheetTitle.replace(/\s+/g, '-').toLowerCase());
  }, [captureFromHTML, config.sheetTitle]);

  const handlePDF = useCallback(async () => {
    await captureFromHTML(exportHandwritingAsPDF, config.sheetTitle.replace(/\s+/g, '-').toLowerCase(), config.paperSize);
  }, [captureFromHTML, config.sheetTitle, config.paperSize]);

  const handlePrint = useCallback(() => {
    printHandwriting(renderWorksheetHTML(config));
  }, [config]);

  const meta = useMemo(() => {
    const { TEMPLATE_META } = require('@/lib/handwriting-utils/types');
    return TEMPLATE_META[config.templateId];
  }, [config.templateId]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-2 border-b bg-muted/20">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Zoom:</span>
          <input
            type="range" min={25} max={200} value={zoom}
            onChange={(e) => setZoom(parseInt(e.target.value))}
            className="w-24 h-1.5"
          />
          <span className="text-xs text-muted-foreground w-8">{zoom}%</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handlePNG} className="btn-ghost text-xs" title="Export PNG">
            <FileImage className="w-3.5 h-3.5 mr-1" /> PNG
          </button>
          <button onClick={handlePDF} className="btn-ghost text-xs" title="Export PDF">
            <FileText className="w-3.5 h-3.5 mr-1" /> PDF
          </button>
          <button onClick={handlePrint} className="btn-ghost text-xs" title="Print">
            <Printer className="w-3.5 h-3.5 mr-1" /> Print
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 bg-muted/20">
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
            title="Worksheet Preview"
            className="w-full border-0 bg-white"
            style={{ minHeight: 500 }}
            sandbox="allow-same-origin"
          />
        </div>
      </div>

      <div className="px-3 py-1.5 border-t text-[10px] text-muted-foreground bg-muted/10 flex justify-between">
        <span>{meta?.name || config.templateId}</span>
        <span>{config.orientation} · {config.paperSize.toUpperCase()} · {config.lineCount} lines · {config.lineSpacing} spacing</span>
      </div>
    </div>
  );
}
