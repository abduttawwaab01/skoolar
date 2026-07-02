'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, Download, Printer, DownloadCloud } from 'lucide-react';
import { useReportCardStore } from '@/store/report-card-store';
import { useAppStore } from '@/store/app-store';
import { ReportCard } from '@/components/features/report-card/report-card-renderer';
import { toast } from 'sonner';

export function ReportCardPreview() {
  const design = useReportCardStore((s) => s.design);
  const selection = useReportCardStore((s) => s.selection);
  const setSelection = useReportCardStore((s) => s.setSelection);
  const { currentUser } = useAppStore();

  const [classes, setClasses] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const schoolId = currentUser?.schoolId || selection.schoolId;

  useEffect(() => {
    if (!schoolId) return;
    Promise.all([
      fetch(`/api/classes?schoolId=${schoolId}`).then(r => r.json()),
      fetch(`/api/terms?schoolId=${schoolId}`).then(r => r.json()),
    ]).then(([clsRes, termRes]) => {
      setClasses(clsRes.data || clsRes.classes || []);
      setTerms(termRes.data || termRes.terms || []);
    });
  }, [schoolId]);

  useEffect(() => {
    if (!selection.classId) { setStudents([]); return; }
    fetch(`/api/students?classId=${selection.classId}&schoolId=${schoolId}&limit=100`)
      .then(r => r.json())
      .then(res => setStudents(res.data || res.students || []));
  }, [selection.classId, schoolId]);

  const handleGenerate = useCallback(async () => {
    if (!selection.studentId || !selection.termId) {
      toast.error('Select a student and term');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/report-cards/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: selection.studentId,
          termId: selection.termId,
          classId: selection.classId,
          schoolId,
          design,
        }),
      });
      if (!res.ok) throw new Error('Preview failed');
      const data = await res.json();
      setReportData(data);
    } catch (err) {
      toast.error('Failed to generate preview');
      setReportData(null);
    } finally {
      setLoading(false);
    }
  }, [selection.studentId, selection.termId, selection.classId, schoolId, design]);

  const handleExportPNG = async () => {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(cardRef.current, { quality: 1, pixelRatio: 3, cacheBust: true });
      const link = document.createElement('a');
      link.download = `Report-Card-${selection.studentId}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      toast.error('PNG export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(cardRef.current, { quality: 1, pixelRatio: 3, cacheBust: true });
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: design.orientation === 'landscape' ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
      doc.addImage(dataUrl, 'PNG', 0, 0, 210, 297);
      doc.save(`Report-Card-${selection.studentId}.pdf`);
    } catch {
      toast.error('PDF export failed');
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => {
    if (!cardRef.current) return;
    const win = window.open('', '_blank');
    if (!win) { toast.error('Pop-up blocked'); return; }
    win.document.write(`<html><head><title>Report Card</title><style>body{margin:0;padding:0}@page{margin:10mm}</style></head><body>`);
    win.document.write(cardRef.current.outerHTML);
    win.document.write('<script>window.print();window.close();</script></body></html>');
    win.document.close();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Class</Label>
              <Select value={selection.classId} onValueChange={(v) => setSelection({ classId: v, studentId: '' })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select class..." /></SelectTrigger>
                <SelectContent>
                  {classes.map((c: any) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Term</Label>
              <Select value={selection.termId} onValueChange={(v) => setSelection({ termId: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select term..." /></SelectTrigger>
                <SelectContent>
                  {terms.map((t: any) => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Student</Label>
              <Select value={selection.studentId} onValueChange={(v) => setSelection({ studentId: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select student..." /></SelectTrigger>
                <SelectContent>
                  {students.map((s: any) => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">{s.name || s.user?.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button size="sm" className="h-8 w-full text-xs" onClick={handleGenerate} disabled={loading || !selection.studentId || !selection.termId}>
                {loading ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Eye className="size-3.5 mr-1" />}
                {loading ? 'Generating...' : 'Generate Preview'}
              </Button>
            </div>
          </div>

          {reportData && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleExportPNG} disabled={exporting}>
                <Download className="size-3 mr-1" /> PNG
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleExportPDF} disabled={exporting}>
                <DownloadCloud className="size-3 mr-1" /> PDF
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handlePrint}>
                <Printer className="size-3 mr-1" /> Print
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="relative border rounded-lg overflow-hidden bg-white shadow-inner" style={{ minHeight: '60vh' }}>
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
            <div className="text-center">
              <Loader2 className="size-8 animate-spin text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Generating preview...</p>
            </div>
          </div>
        ) : reportData ? (
          <div className="flex justify-center p-4 bg-gray-100">
            <div ref={cardRef} className="shadow-2xl bg-white" style={{ width: '210mm', transform: 'scale(0.85)', transformOrigin: 'top center' }}>
              <ReportCard data={reportData} />
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Eye className="size-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Select class, term, and student</p>
              <p className="text-xs mt-1">then click Generate Preview</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
