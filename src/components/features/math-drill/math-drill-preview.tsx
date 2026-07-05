'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useMathDrillStore } from '@/store/math-drill-store';
import { renderMathDrillHTML } from '@/lib/math-drill-utils/render-drill';
import { exportMathDrillAsPNG, exportMathDrillAsPDF, printMathDrill } from '@/lib/math-drill-utils/export';
import { TEMPLATE_META, DIFFICULTY_RANGES } from '@/lib/math-drill-utils';
import { FileImage, FileText, Printer, Shuffle } from 'lucide-react';

export function MathDrillPreview() {
  const { config, problems, regenerateProblems } = useMathDrillStore();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [zoom, setZoom] = useState(75);
  const htmlContent = useMemo(
    () => renderMathDrillHTML(config, problems),
    [config, problems]
  );

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !htmlContent) return;
    iframe.srcdoc = htmlContent;
  }, [htmlContent]);

  const handlePNG = useCallback(async () => {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument?.body) return;
    try {
      const el = iframe.contentDocument.body.firstElementChild as HTMLElement;
      if (el) await exportMathDrillAsPNG(el, config.sheetTitle.replace(/\s+/g, '-').toLowerCase());
    } catch (err) { console.error(err); }
  }, [config.sheetTitle]);

  const handlePDF = useCallback(async () => {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument?.body) return;
    try {
      const el = iframe.contentDocument.body.firstElementChild as HTMLElement;
      if (el) await exportMathDrillAsPDF(el, config.sheetTitle.replace(/\s+/g, '-').toLowerCase(), config.paperSize);
    } catch (err) { console.error(err); }
  }, [config.sheetTitle, config.paperSize]);

  const handlePrint = useCallback(() => {
    printMathDrill(renderMathDrillHTML(config, problems));
  }, [config, problems]);

  const meta = TEMPLATE_META[config.templateId];
  const diffLabel = DIFFICULTY_RANGES[config.difficulty].label;

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
          <button onClick={regenerateProblems} className="btn-ghost text-xs" title="New Problems">
            <Shuffle className="w-3.5 h-3.5 mr-1" /> Shuffle
          </button>
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
            title="Math Drill Preview"
            className="w-full border-0 bg-white"
            style={{ minHeight: 500 }}
            sandbox="allow-same-origin"
          />
        </div>
      </div>

      <div className="px-3 py-1.5 border-t text-[10px] text-muted-foreground bg-muted/10 flex justify-between">
        <span>{meta?.name || config.templateId}</span>
        <span>{diffLabel} · {problems.length} problems · {config.columns} cols · {config.orientation} · {config.paperSize.toUpperCase()}</span>
      </div>
    </div>
  );
}
