'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, Download, Printer, DownloadCloud } from 'lucide-react';
import { useReportCardStore } from '@/store/report-card-store';
import { useAppStore } from '@/store/app-store';
import { ReportCard, type ReportCardData } from '@/components/features/report-card/report-card-renderer';
import { toast } from 'sonner';

const SAMPLE_DATA: ReportCardData = {
  schoolName: 'Skoolar International School',
  schoolMotto: 'Excellence in Education',
  schoolAddress: '123 Education Avenue, Knowledge City',
  studentName: 'Abdut Tawwab',
  studentId: 'SKL-2024-001',
  className: 'SS 2A',
  term: 'Third Term',
  session: '2024/2025',
  subjects: [
    { subject: 'Mathematics', score: 92, total: 100, grade: 'A', remark: 'Excellent' },
    { subject: 'English Language', score: 88, total: 100, grade: 'B', remark: 'Very Good' },
    { subject: 'Physics', score: 85, total: 100, grade: 'B', remark: 'Very Good' },
    { subject: 'Chemistry', score: 90, total: 100, grade: 'A', remark: 'Excellent' },
    { subject: 'Biology', score: 87, total: 100, grade: 'B', remark: 'Very Good' },
  ],
  domains: [
    { name: 'Cognitive', score: 15, max: 20 },
    { name: 'Affective', score: 14, max: 20 },
    { name: 'Psychomotor', score: 16, max: 20 },
  ],
  attendance: { present: 42, absent: 2, late: 1, total: 45 },
  teacherComment: 'A brilliant student with great potential. Keep up the good work.',
  teacherName: 'Mr. Johnson',
  principalComment: 'Excellent performance. Maintain the focus.',
  position: '2nd',
  totalStudents: 35,
  generatedAt: new Date().toISOString(),
};

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function buildReportCardData(
  studentId: string,
  termId: string,
  classId: string,
  schoolId: string,
  schoolName: string
): Promise<ReportCardData> {
  const [studentData, termData] = await Promise.all([
    fetchJson(`/api/students/${studentId}?schoolId=${schoolId}`),
    fetchJson(`/api/terms/${termId}?schoolId=${schoolId}`),
  ]);

  const student = studentData.data || studentData.student || studentData;
  const term = termData.data || termData.term || termData;

  const studentName = student.user?.name || student.name || `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Unknown';
  const studentIdNumber = student.admissionNo || student.id || studentId;
  const className = student.class?.name || student.className || classId;
  const termName = term.name || term.termName || 'Term';
  const session = term.session || term.academicSession || '';

  // Resolve student photo — prefer user.avatar, fall back to student.photo
  const photoUrl = student.user?.avatar || student.photo;
  const studentPhoto = photoUrl ? (photoUrl.startsWith('http') || photoUrl.startsWith('data:') ? photoUrl : null) : null;

  // Try to get results/scores and attendance
  let subjects: ReportCardData['subjects'] = [];
  let attendance: ReportCardData['attendance'] = { present: 0, absent: 0, late: 0, total: 0 };
  try {
    const resultsRes = await fetch(`/api/results?studentId=${studentId}&termId=${termId}&schoolId=${schoolId}`);
    if (resultsRes.ok) {
      const resultsJson = await resultsRes.json();
      const responseData = resultsJson.data;
      const terms = responseData?.terms;
      if (Array.isArray(terms) && terms.length > 0) {
        const termResults = terms[0];
        const rawSubjects: any[] = termResults.subjects || [];
        subjects = rawSubjects.map((r: any) => ({
          subject: r.subjectName || r.subject || 'Unknown',
          score: r.score ?? 0,
          total: r.totalMarks ?? 100,
          grade: r.grade || '',
          remark: r.remark || '',
        }));
      }
      const attSummary = responseData?.attendanceSummary;
      if (attSummary) {
        attendance = {
          present: attSummary.present ?? 0,
          absent: attSummary.absent ?? 0,
          late: attSummary.late ?? 0,
          total: attSummary.total ?? 0,
        };
      }
    }
  } catch {
    // No results — empty subjects/attendance is fine
  }

  // Enrich subjects with CA/Exam breakdown from stored report card (if one exists)
  try {
    const rcListRes = await fetch(`/api/report-cards?studentId=${studentId}&termId=${termId}&schoolId=${schoolId}&limit=1`);
    if (rcListRes.ok) {
      const rcList = await rcListRes.json();
      const rcData = Array.isArray(rcList.data) ? rcList.data[0] : null;
      if (rcData?.id) {
        const rcDetailRes = await fetch(`/api/report-cards/${rcData.id}?schoolId=${schoolId}`);
        if (rcDetailRes.ok) {
          const rcDetail = await rcDetailRes.json();
          const srList: any[] = rcDetail.subjectResults || [];
          const caExamMap = new Map<string, { caScore: number; examScore: number }>();
          for (const sr of srList) {
            caExamMap.set(sr.subjectName, { caScore: sr.caScore ?? 0, examScore: sr.examScore ?? 0 });
          }
          if (caExamMap.size > 0) {
            subjects = subjects.map(s => {
              const breakdown = caExamMap.get(s.subject);
              return breakdown ? { ...s, caScore: breakdown.caScore, examScore: breakdown.examScore } : s;
            });
          }
        }
      }
    }
  } catch {
    // Fall back to aggregated data — CA/Exam columns will show "-"
  }

  return {
    schoolName: schoolName || 'School',
    schoolMotto: student.school?.motto || '',
    schoolAddress: student.school?.address || '',
    studentName,
    studentId: studentIdNumber,
    studentPhoto,
    className,
    term: termName,
    session,
    subjects,
    domains: [
      { name: 'Cognitive', score: 0, max: 20 },
      { name: 'Affective', score: 0, max: 20 },
      { name: 'Psychomotor', score: 0, max: 20 },
    ],
    attendance,
    teacherComment: '',
    principalComment: '',
    position: '',
    totalStudents: 0,
    generatedAt: new Date().toISOString(),
  };
}

export function ReportCardPreview() {
  const design = useReportCardStore((s) => s.design);
  const selection = useReportCardStore((s) => s.selection);
  const setSelection = useReportCardStore((s) => s.setSelection);
  const { currentUser } = useAppStore();

  const [classes, setClasses] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [reportData, setReportData] = useState<ReportCardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [usingSampleData, setUsingSampleData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const schoolId = currentUser?.schoolId || selection.schoolId;
  const schoolName = currentUser?.schoolName || 'Skoolar International School';

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

  useEffect(() => {
    if (!selection.studentId) {
      setReportData(SAMPLE_DATA);
      setUsingSampleData(true);
      setError(null);
    }
  }, [selection.studentId]);

  const handleGenerate = useCallback(async () => {
    if (!selection.studentId || !selection.termId) {
      toast.error('Select a student and term');
      return;
    }
    setUsingSampleData(false);
    setLoading(true);
    setError(null);
    try {
      const data = await buildReportCardData(
        selection.studentId,
        selection.termId,
        selection.classId,
        schoolId,
        schoolName
      );
      setReportData(data);
    } catch (err) {
      setError('Failed to load student data. Preview may be incomplete.');
      toast.error('Could not load student details');
      // Still show sample data as fallback
      setReportData(SAMPLE_DATA);
      setUsingSampleData(true);
    } finally {
      setLoading(false);
    }
  }, [selection.studentId, selection.termId, selection.classId, schoolId, schoolName]);

  const captureReportCard = async (): Promise<string> => {
    const el = cardRef.current;
    if (!el) throw new Error('No card element');

    // toPng clones the element with computed styles. The offscreen div's
    // position:absolute;left:-9999px would be cloned, making content invisible.
    // Temporarily reset to relative positioning so the clone renders at (0,0).
    const origPos = el.style.position;
    const origLeft = el.style.left;
    const origTop = el.style.top;
    el.style.position = 'relative';
    el.style.left = '0';
    el.style.top = '0';

    await document.fonts.ready;
    await new Promise(r => requestAnimationFrame(r));

    const { toPng } = await import('html-to-image');
    try {
      return await toPng(el, { quality: 1, pixelRatio: 2, backgroundColor: '#ffffff' });
    } finally {
      el.style.position = origPos;
      el.style.left = origLeft;
      el.style.top = origTop;
    }
  };

  const handleExportPNG = async () => {
    setExporting(true);
    try {
      const dataUrl = await captureReportCard();
      const link = document.createElement('a');
      link.download = `Report-Card-${usingSampleData ? 'preview' : selection.studentId}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      toast.error('PNG export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const dataUrl = await captureReportCard();
      const { jsPDF } = await import('jspdf');
      const orient = design.orientation === 'landscape' ? 'landscape' : 'portrait';
      const doc = new jsPDF({ orientation: orient, unit: 'mm', format: 'a4' });
      const pw = doc.internal.pageSize.getWidth();
      const ph = doc.internal.pageSize.getHeight();

      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = dataUrl;
      });

      const imgW = img.naturalWidth;
      const imgH = img.naturalHeight;
      const cssW = imgW / 2;
      const cssH = imgH / 2;
      const mmW = (cssW / 96) * 25.4;
      const mmH = (cssH / 96) * 25.4;

      const scale = Math.min(pw / mmW, ph / mmH);
      const finalW = mmW * scale;
      const finalH = mmH * scale;
      doc.addImage(dataUrl, 'PNG', (pw - finalW) / 2, (ph - finalH) / 2, finalW, finalH, undefined, 'FAST');
      doc.save(`Report-Card-${usingSampleData ? 'preview' : selection.studentId}.pdf`);
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
    <div className="p-2 sm:p-4 space-y-3 sm:space-y-4 h-full flex flex-col">
      <Card>
        <CardContent className="p-3 sm:p-4 space-y-3 sm:space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
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
                {loading ? 'Loading...' : 'Generate Preview'}
              </Button>
            </div>
          </div>

          {reportData && (
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              {usingSampleData && (
                <p className="text-[10px] sm:text-xs text-muted-foreground italic mr-1 sm:mr-2">
                  {error ? 'Using sample preview due to load error.' : 'Showing sample preview. Select a student and term then click Generate.'}
                </p>
              )}
              <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={handleExportPNG} disabled={exporting}>
                <Download className="size-3 mr-1" /> PNG
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={handleExportPDF} disabled={exporting}>
                <DownloadCloud className="size-3 mr-1" /> PDF
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={handlePrint}>
                <Printer className="size-3 mr-1" /> Print
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex-1 border rounded-lg overflow-hidden bg-white shadow-inner" style={{ minHeight: '50vh' }}>
        {loading ? (
          <div className="flex items-center justify-center h-full bg-muted/20">
            <div className="text-center">
              <Loader2 className="size-8 animate-spin text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Generating preview...</p>
            </div>
          </div>
        ) : reportData ? (
          <>
          <div className="flex justify-center p-2 sm:p-4 bg-gray-100 overflow-auto">
            <div className="shadow-2xl bg-white" style={{ width: '210mm', overflow: 'hidden' }}>
              <div className="scale-[0.4] sm:scale-[0.6] md:scale-[0.75] origin-top-center">
                <ReportCard data={reportData} design={design} />
              </div>
            </div>
          </div>
          <div ref={cardRef} style={{ position: 'absolute', left: '-9999px', top: 0, width: '210mm', height: '297mm', overflow: 'hidden', background: '#fff' }}>
            <ReportCard data={reportData} design={design} />
          </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
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
