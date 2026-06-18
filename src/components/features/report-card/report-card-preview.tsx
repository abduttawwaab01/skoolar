'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, AlertCircle, RefreshCw, Save, Download, Upload } from 'lucide-react';
import { useReportCardStore } from '@/store/report-card-store';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';

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
  const [error, setError] = useState<string | null>(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const lastDesignUpdate = useRef<number>(0);
  const refreshInterval = useRef<NodeJS.Timeout>();

  const schoolId = currentUser?.schoolId || selection.schoolId;

  // Fetch initial data
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

  // Fetch students when class changes
  useEffect(() => {
    if (!selection.classId) { setStudents([]); return; }
    fetch(`/api/students?classId=${selection.classId}`)
      .then(r => r.json())
      .then(res => setStudents(res.data || res.students || []));
  }, [selection.classId]);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
      }
    };
  }, []);

  // Auto-refresh preview when design changes
  useEffect(() => {
    if (!autoRefreshEnabled || !selection.studentId || !selection.termId) return;

    const now = Date.now();
    if (now - lastDesignUpdate.current > 2000) {
      lastDesignUpdate.current = now;
      handlePreview();
    }

    return () => {
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
      }
    };
  }, [design, selection.studentId, selection.termId, autoRefreshEnabled]);

  const handlePreview = useCallback(async () => {
    if (!selection.studentId || !selection.termId) { return; }
    setPreview({ previewLoading: true });
    setError(null);
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
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: `Server error (${res.status})` }));
        throw new Error(errBody.error || 'Preview failed');
      }
      const blob = await res.blob();
      if (blob.size < 100) throw new Error('Generated image is too small — render may have failed');
      setPreview({ previewSrc: URL.createObjectURL(blob) });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Preview failed';
      setError(msg);
      toast.error(msg);
      setPreview({ previewSrc: null });
    } finally {
      setPreview({ previewLoading: false });
    }
  }, [selection.studentId, selection.termId, selection.classId, schoolId, design, setPreview]);

  const handleSavePreview = async () => {
    if (!preview.previewSrc) { toast.error('No preview to save'); return; }
    try {
      const res = await fetch('/api/report-cards/preview/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          previewSrc: preview.previewSrc,
          design,
          selection,
          schoolId,
        }),
      });
      if (!res.ok) throw new Error('Failed to save preview');
      toast.success('Preview saved successfully');
    } catch {
      toast.error('Failed to save preview');
    }
  };

  const handleDownloadPreview = () => {
    if (!preview.previewSrc) { toast.error('No preview to download'); return; }
    const link = document.createElement('a');
    link.href = preview.previewSrc;
    link.download = `report-card-preview-${Date.now()}.png`;
    link.click();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="size-4" />Live Preview
            {preview.previewSrc && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" title="Live preview active" />
                <span className="text-[10px] text-muted-foreground">Auto-refresh</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="size-6"
              onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
              title={autoRefreshEnabled ? 'Disable auto-refresh' : 'Enable auto-refresh'}
            >
              <RefreshCw className={`size-3 ${autoRefreshEnabled ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-6"
              onClick={handleSavePreview}
              disabled={!preview.previewSrc}
              title="Save preview"
            >
              <Save className="size-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-6"
              onClick={handleDownloadPreview}
              disabled={!preview.previewSrc}
              title="Download preview"
            >
              <Download className="size-3" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
        </div>

        <div className="flex items-center justify-between">
          <Button size="sm" onClick={handlePreview} disabled={preview.previewLoading || !selection.studentId || !selection.termId}>
            {preview.previewLoading ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Eye className="size-3.5 mr-1" />}
            {preview.previewLoading ? 'Generating...' : 'Generate Preview'}
          </Button>
          <div className="text-[10px] text-muted-foreground">
            Design changes auto-refresh after 2 seconds
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-destructive/10 text-destructive text-xs">
            <AlertCircle className="size-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="relative border rounded-lg overflow-hidden bg-white shadow-inner" style={{ aspectRatio: '210/297', maxHeight: '70vh' }}>
          {preview.previewLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
              <div className="text-center">
                <Loader2 className="size-8 animate-spin text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Generating preview...</p>
              </div>
            </div>
          ) : preview.previewSrc ? (
            <img src={preview.previewSrc} alt="Report card preview" className="w-full h-full object-contain" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Eye className="size-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">Select student and term, then click Generate Preview</p>
                <p className="text-[10px] mt-1">Or wait for auto-refresh when design changes</p>
              </div>
            </div>
          )}
        </div>

        {preview.previewSrc && (
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Preview generated at {new Date().toLocaleTimeString()}</span>
            <span>Design: {design.name}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
