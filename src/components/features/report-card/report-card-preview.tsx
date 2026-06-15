'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, Eye } from 'lucide-react';
import { useReportCardStore } from '@/store/report-card-store';
import { useAppStore } from '@/store/app-store';
import { cn } from '@/lib/utils';

export function ReportCardPreview() {
  const design = useReportCardStore((s) => s.design);
  const preview = useReportCardStore((s) => s.preview);
  const setPreview = useReportCardStore((s) => s.setPreview);
  const selection = useReportCardStore((s) => s.selection);
  const setSelection = useReportCardStore((s) => s.setSelection);
  const { currentUser } = useAppStore();

  const [classes, setClasses] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  const schoolId = currentUser?.schoolId || selection.schoolId;

  useEffect(() => {
    if (!schoolId) return;
    setLoadingOptions(true);
    Promise.all([
      fetch(`/api/classes?schoolId=${schoolId}`).then(r => r.json()),
      fetch(`/api/terms?schoolId=${schoolId}`).then(r => r.json()),
    ]).then(([clsRes, termRes]) => {
      setClasses(clsRes.data || clsRes.classes || []);
      setTerms(termRes.data || termRes.terms || []);
    }).finally(() => setLoadingOptions(false));
  }, [schoolId]);

  useEffect(() => {
    if (!selection.classId) { setStudents([]); return; }
    fetch(`/api/students?classId=${selection.classId}`)
      .then(r => r.json())
      .then(res => setStudents(res.data || res.students || []));
  }, [selection.classId]);

  const handlePreview = useCallback(async () => {
    if (!selection.studentId || !selection.termId) { return; }
    setPreview({ previewLoading: true });
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
      const blob = await res.blob();
      setPreview({ previewSrc: URL.createObjectURL(blob) });
    } catch {
      setPreview({ previewSrc: null });
    } finally {
      setPreview({ previewLoading: false });
    }
  }, [selection.studentId, selection.termId, selection.classId, schoolId, design, setPreview]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Eye className="size-4" />Live Preview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Class</Label>
            <Select value={selection.classId} onValueChange={(v) => setSelection({ classId: v, studentId: '' })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                {classes.map((c: any) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Term</Label>
            <Select value={selection.termId} onValueChange={(v) => setSelection({ termId: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                {terms.map((t: any) => (
                  <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Student</Label>
            <Select value={selection.studentId} onValueChange={(v) => setSelection({ studentId: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                {students.map((s: any) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">{s.name || s.user?.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button size="sm" onClick={handlePreview} disabled={preview.previewLoading || !selection.studentId || !selection.termId}>
          {preview.previewLoading ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Eye className="size-3.5 mr-1" />}
          {preview.previewLoading ? 'Generating...' : 'Generate Preview'}
        </Button>

        <div className="relative border rounded-lg overflow-hidden bg-white" style={{ aspectRatio: '210/297', maxHeight: '70vh' }}>
          {preview.previewLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : preview.previewSrc ? (
            <img src={preview.previewSrc} alt="Report card preview" className="w-full h-full object-contain" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs">
              Select student and term, then click Generate Preview
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
