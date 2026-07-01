'use client';

import { useMemo, useEffect, useRef } from 'react';
import { useHandwritingStore } from '@/store/handwriting-store';
import { renderWorksheetHTML } from '@/lib/handwriting-utils/render-worksheet';
import { TEMPLATE_META } from '@/lib/handwriting-utils';
import { Printer, FilePdf } from 'lucide-react';
import { printHandwriting, exportHandwritingAsPDF } from '@/lib/handwriting-utils/export';

export function HandwritingStudentView() {
  const { config } = useHandwritingStore();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const htmlContent = useMemo(() => renderWorksheetHTML(config), [config]);
  const meta = TEMPLATE_META[config.templateId];

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !htmlContent) return;
    iframe.srcdoc = htmlContent;
  }, [htmlContent]);

  const handlePrint = () => printHandwriting(renderWorksheetHTML(config));
  const handlePDF = async () => {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument?.body) return;
    try {
      const el = iframe.contentDocument.body.firstElementChild as HTMLElement;
      if (el) await exportHandwritingAsPDF(el, 'handwriting-practice', config.paperSize);
    } catch (err) { console.error(err); }
  };

  return (
    <div className="flex flex-col h-full p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold">{config.sheetTitle}</h3>
          <p className="text-[10px] text-muted-foreground">{meta?.name} · {config.orientation} · {config.paperSize.toUpperCase()}</p>
        </div>
        <div className="flex gap-1">
          <button onClick={handlePDF} className="btn-ghost text-xs"><FilePdf className="w-3.5 h-3.5 mr-1" /> PDF</button>
          <button onClick={handlePrint} className="btn-ghost text-xs"><Printer className="w-3.5 h-3.5 mr-1" /> Print</button>
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-muted/20 rounded-lg p-4">
        <div className="mx-auto max-w-[800px] shadow-lg rounded-lg overflow-hidden bg-white">
          <iframe
            ref={iframeRef}
            title="Handwriting Practice Sheet"
            className="w-full border-0 bg-white"
            style={{ minHeight: 700 }}
            sandbox="allow-same-origin"
          />
        </div>
      </div>
    </div>
  );
}
