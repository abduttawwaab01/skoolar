'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { Award, Eye, FileText, Loader2, Download, Printer } from 'lucide-react';
import { ReportCardRenderer, type ReportCardData, type MetaData } from './report-card-view';

interface ApiReportCard {
  id: string;
  gpa: number | null;
  classRank: number | null;
  averageScore: number | null;
  totalScore: number | null;
  grade: string | null;
  termId: string;
  term: { id: string; name: string } | null;
  isPublished?: boolean;
}

function getGradeColor(grade: string): string {
  switch (grade) {
    case 'A+':
    case 'A': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'A-': return 'bg-emerald-50 text-emerald-600 border-emerald-200';
    case 'B+': return 'bg-sky-100 text-sky-700 border-sky-200';
    case 'B': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'C': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'D': return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'F': return 'bg-red-100 text-red-700 border-red-200';
    default: return '';
  }
}

export function StudentReportCards() {
  const { currentUser, selectedSchoolId } = useAppStore();
  const schoolId = currentUser.schoolId || selectedSchoolId || '';

  const [loading, setLoading] = useState(true);
  const [studentId, setStudentId] = useState('');
  const [classId, setClassId] = useState('');
  const [reportCards, setReportCards] = useState<ApiReportCard[]>([]);

  const [rcDialogOpen, setRcDialogOpen] = useState(false);
  const [rcLoading, setRcLoading] = useState(false);
  const [rcData, setRcData] = useState<ReportCardData | null>(null);
  const [rcMeta, setRcMeta] = useState<MetaData | null>(null);
  const [rcTermId, setRcTermId] = useState('');
  const rcScaleRef = useRef<HTMLDivElement>(null);
  const [rcScale, setRcScale] = useState(1);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const studentsRes = await fetch(`/api/students?schoolId=${schoolId}&search=${encodeURIComponent(currentUser.email)}&limit=5`);
        let studentData: { id: string; class: { id: string } | null }[] = [];
        if (studentsRes.ok) {
          const json = await studentsRes.json();
          studentData = json.data || json || [];
        }

        if (studentData.length > 0) {
          const sid = studentData[0].id;
          setStudentId(sid);
          if (studentData[0].class) setClassId(studentData[0].class.id);

          const rcRes = await fetch(`/api/report-cards?studentId=${sid}&limit=10`);
          if (rcRes.ok) {
            const rcJson = await rcRes.json();
            setReportCards(rcJson.data || rcJson || []);
          }
        }
      } catch {
        toast.error('Failed to load report cards');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentUser.email, schoolId]);

  const handleViewReportCard = async (termId: string) => {
    if (!schoolId || !studentId || !classId) {
      toast.error('Missing student or class information');
      return;
    }
    setRcLoading(true);
    setRcDialogOpen(true);
    setRcTermId(termId);
    try {
      const rc = reportCards.find(r => r.termId === termId);
      if (!rc) {
        toast.error('Report card not found');
        setRcDialogOpen(false);
        return;
      }
      const res = await fetch(`/api/report-cards/${rc.id}/view`);
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Failed to load report card');
        setRcDialogOpen(false);
        return;
      }
      if (json.data) {
        setRcData(json.data);
        setRcMeta(json.meta || null);
      } else {
        toast.error('No report card data found for this term');
        setRcDialogOpen(false);
      }
    } catch {
      toast.error('Failed to load report card');
      setRcDialogOpen(false);
    } finally {
      setRcLoading(false);
    }
  };

  // Auto-scale report card preview on mobile
  useEffect(() => {
    const el = rcScaleRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const parent = entry.target.parentElement;
        if (!parent) continue;
        const pw = parent.clientWidth;
        const cw = entry.target.scrollWidth;
        setRcScale(cw > pw && pw > 0 ? Math.min(1, pw / cw) : 1);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [rcData, rcMeta]);

  const currentRc = reportCards.find(rc => rc.termId === rcTermId);

  const handleDownloadPdf = async (termId: string) => {
    const rc = reportCards.find(r => r.termId === termId);
    if (!rc) { toast.error('Report card not found'); return; }
    try {
      const res = await fetch(`/api/report-cards/${rc.id}/pdf`);
      if (!res.ok) throw new Error('Failed to generate PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-card-${rc.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Failed to download PDF'); }
  };

  const handlePrint = () => {
    window.print();
  };

  const publishedCards = reportCards.filter(rc => rc.isPublished !== false);

  if (loading) {
    return (
      <div className="space-y-6">
        <div><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-32 mt-2" /></div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Report Cards</h1>
        <p className="text-muted-foreground">View your published report cards by term</p>
      </div>

      {publishedCards.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {publishedCards.map(rc => (
            <Card key={rc.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Award className="size-4 text-emerald-600" />
                  {rc.term?.name || 'Unknown Term'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">GPA</span>
                    <span className="font-semibold">{rc.gpa?.toFixed(2) || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Class Rank</span>
                    <span className="font-semibold">{rc.classRank ? `#${rc.classRank}` : '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Average</span>
                    <span className="font-semibold">{rc.averageScore?.toFixed(1) || '—'}%</span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <Badge variant="outline" className={getGradeColor(rc.grade || 'F')}>{rc.grade || 'N/A'}</Badge>
                    <Button size="sm" variant="outline" onClick={() => handleViewReportCard(rc.termId)} className="text-emerald-600 border-emerald-300 hover:bg-emerald-50">
                      <Eye className="size-3.5 mr-1.5" /> View
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No published report cards available yet
          </CardContent>
        </Card>
      )}

      <Dialog open={rcDialogOpen} onOpenChange={setRcDialogOpen}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto p-0 sm:p-0">
          <DialogHeader className="px-4 sm:px-6 pt-4 pb-0">
            <DialogTitle className="flex items-center gap-2 text-sm sm:text-base">
              <FileText className="size-4 sm:size-5 text-emerald-600" />
              Report Card — {rcData?.student?.name || 'Student'}
            </DialogTitle>
            <div className="flex gap-2 mt-2">
              <Button size="sm" variant="outline" onClick={handlePrint}>
                <Printer className="size-3.5 mr-1.5" /> Print
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleDownloadPdf(rcTermId)} disabled={!rcTermId || rcLoading}>
                <Download className="size-3.5 mr-1.5" /> Download PDF
              </Button>
            </div>
          </DialogHeader>
          <div className="px-2 sm:px-4 pb-4">
            <ScrollArea className="max-h-[calc(90vh-120px)] overflow-hidden">
              {rcLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="size-8 text-emerald-600 animate-spin" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading report card...</span>
                </div>
              ) : rcData ? (
                <div className="mx-auto" ref={rcScaleRef} style={{ transform: `scale(${rcScale})`, transformOrigin: 'top left', width: rcScale < 1 ? `${100 / rcScale}%` : undefined }}>
                  <ReportCardRenderer currentCard={rcData} meta={rcMeta} />
                </div>
              ) : (
                <div className="py-16 text-center text-muted-foreground">No report card data available</div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
