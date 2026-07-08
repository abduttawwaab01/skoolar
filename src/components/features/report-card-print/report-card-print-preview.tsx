'use client';

import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useReportCardPrintStore } from '@/store/report-card-print-store';
import { calculateAllStudents } from '@/lib/report-card-print-utils/calculations';
import { renderReportCardPrintHTML } from '@/lib/report-card-print-utils/render';
import { exportReportCardPrintAsPNG, exportReportCardPrintAsPDF, printReportCard } from '@/lib/report-card-print-utils/export';
import { ChevronLeft, ChevronRight, Download, Printer, FileImage } from 'lucide-react';

export function ReportCardPrintPreview() {
  const { config, currentStudentIndex, setCurrentStudentIndex } = useReportCardPrintStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [iframeHeight, setIframeHeight] = useState(0);

  const calculated = useMemo(() => calculateAllStudents(config), [config]);

  const student = calculated[currentStudentIndex];
  const total = calculated.length;

  const html = useMemo(() => {
    if (!student) return '<html><body><p style="padding:2em;color:#888;font-family:sans-serif;">No data to preview. Add students and scores.</p></body></html>';
    return renderReportCardPrintHTML(config, currentStudentIndex);
  }, [config, currentStudentIndex, calculated, student]);

  const blobUrl = useMemo(() => {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    return URL.createObjectURL(blob);
  }, [html]);

  useEffect(() => {
    return () => { URL.revokeObjectURL(blobUrl); };
  }, [blobUrl]);

  useEffect(() => {
    const iframe = containerRef.current?.querySelector('iframe');
    if (!iframe) return;
    const handleLoad = () => {
      try {
        const doc = (iframe as HTMLIFrameElement).contentDocument || (iframe as HTMLIFrameElement).contentWindow?.document;
        if (doc) {
          const body = doc.body;
          const h = body?.scrollHeight || 0;
          setIframeHeight(h);
        }
      } catch { /* cross-origin */ }
    };
    iframe.addEventListener('load', handleLoad);
    return () => iframe.removeEventListener('load', handleLoad);
  }, [blobUrl]);

  const handlePNG = async () => {
    const iframe = containerRef.current?.querySelector('iframe');
    if (!iframe) return;
    try {
      const doc = (iframe as HTMLIFrameElement).contentDocument || (iframe as HTMLIFrameElement).contentWindow?.document;
      const el = doc?.body?.firstElementChild as HTMLElement;
      if (el) await exportReportCardPrintAsPNG(el, `report-card-${student?.name || 'student'}`);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePDF = async () => {
    const iframe = containerRef.current?.querySelector('iframe');
    if (!iframe) return;
    try {
      const doc = (iframe as HTMLIFrameElement).contentDocument || (iframe as HTMLIFrameElement).contentWindow?.document;
      const el = doc?.body?.firstElementChild as HTMLElement;
      if (el) await exportReportCardPrintAsPDF(el, `report-card-${student?.name || 'student'}`);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-card sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" disabled={currentStudentIndex <= 0} onClick={() => setCurrentStudentIndex(currentStudentIndex - 1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm font-medium">
            {total > 0 ? `${student?.name || 'Student'} (${currentStudentIndex + 1} / ${total})` : 'No students'}
          </span>
          <Button variant="outline" size="icon" disabled={currentStudentIndex >= total - 1} onClick={() => setCurrentStudentIndex(currentStudentIndex + 1)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => printReportCard(html)}>
            <Printer className="size-3 mr-1" />Print
          </Button>
          <Button variant="outline" size="sm" onClick={handlePNG}>
            <FileImage className="size-3 mr-1" />PNG
          </Button>
          <Button variant="outline" size="sm" onClick={handlePDF}>
            <Download className="size-3 mr-1" />PDF
          </Button>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 overflow-auto bg-muted/30 p-4">
        {total === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Add students and scores to preview report cards.
          </div>
        ) : (
          <div className="flex justify-center">
            <iframe
              src={blobUrl}
              className="border shadow-sm bg-white"
              style={{
                width: '210mm',
                minHeight: iframeHeight > 0 ? `${iframeHeight}px` : '297mm',
                border: 'none',
              }}
              title="Report Card Preview"
            />
          </div>
        )}
      </div>
    </div>
  );
}
