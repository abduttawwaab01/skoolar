'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useAttendanceStore } from '@/store/attendance-store';
import { renderAttendanceHTML } from '@/lib/attendance-utils/render';
import { exportAttendanceAsPNG, exportAttendanceAsPDF, printAttendance } from '@/lib/attendance-utils/export';
import { TEMPLATE_META } from '@/lib/attendance-utils';
import { FileImage, FileText, Printer } from 'lucide-react';

export function AttendancePreview() {
  const { config } = useAttendanceStore();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [zoom, setZoom] = useState(70);
  const htmlContent = useMemo(
    () => renderAttendanceHTML(config),
    [config]
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
      if (el) await exportAttendanceAsPNG(el, config.sheetTitle.replace(/\s+/g, '-').toLowerCase());
    } catch (err) { console.error(err); }
  }, [config.sheetTitle]);

  const handlePDF = useCallback(async () => {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument?.body) return;
    try {
      const el = iframe.contentDocument.body.firstElementChild as HTMLElement;
      if (el) await exportAttendanceAsPDF(el, config.sheetTitle.replace(/\s+/g, '-').toLowerCase(), config.paperSize);
    } catch (err) { console.error(err); }
  }, [config.sheetTitle, config.paperSize]);

  const handlePrint = useCallback(() => {
    printAttendance(renderAttendanceHTML(config));
  }, [config]);

  const meta = TEMPLATE_META[config.templateId];
  const weekdays = getWeekdayCount(config.startDate, config.endDate);

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
            title="Attendance Register Preview"
            className="w-full border-0 bg-white"
            style={{ minHeight: 600 }}
            sandbox="allow-scripts"
          />
        </div>
      </div>

      <div className="px-3 py-1.5 border-t text-[10px] text-muted-foreground bg-muted/10 flex justify-between">
        <span>{meta?.name || config.templateId}</span>
        <span>{config.students.length} students · {weekdays} school days · {config.orientation} · {config.paperSize.toUpperCase()}</span>
      </div>
    </div>
  );
}

function getWeekdayCount(start: string, end: string): number {
  let count = 0;
  const current = new Date(start);
  const endDate = new Date(end);
  current.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);
  while (current <= endDate) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}
