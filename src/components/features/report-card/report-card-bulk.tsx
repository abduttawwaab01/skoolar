'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Layers, Download } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';

export function ReportCardBulk() {
  const { currentUser } = useAppStore();
  const schoolId = currentUser?.schoolId || '';

  const [classes, setClasses] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedTermId, setSelectedTermId] = useState('');
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

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

  const handleBulkGenerate = async () => {
    if (!selectedClassId || !selectedTermId) { toast.error('Select class and term'); return; }
    setGenerating(true);
    setProgress(0);
    try {
      const interval = setInterval(() => setProgress((p) => Math.min(p + 10, 90)), 500);
      const res = await fetch('/api/report-cards/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: selectedClassId, termId: selectedTermId, schoolId }),
      });
      clearInterval(interval);
      if (!res.ok) throw new Error('Generation failed');
      setProgress(100);
      toast.success('Report cards generated');
    } catch {
      toast.error('Bulk generation failed');
    } finally {
      setGenerating(false);
      setTimeout(() => setProgress(0), 1500);
    }
  };

  const handleBulkExport = async (format: string) => {
    if (!selectedClassId || !selectedTermId) { toast.error('Select class and term'); return; }
    try {
      const res = await fetch('/api/report-cards/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: selectedClassId, termId: selectedTermId, schoolId, format }),
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-cards-${selectedClassId}-${selectedTermId}.${format === 'pdf' ? 'zip' : format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch {
      toast.error('Export failed');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Layers className="size-4" />Bulk Generate Report Cards
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Class</Label>
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select class..." /></SelectTrigger>
                <SelectContent>
                  {classes.map((c: any) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Term</Label>
              <Select value={selectedTermId} onValueChange={setSelectedTermId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select term..." /></SelectTrigger>
                <SelectContent>
                  {terms.map((t: any) => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {generating && <Progress value={progress} className="h-1.5" />}

          <div className="flex gap-2">
            <Button size="sm" onClick={handleBulkGenerate} disabled={generating || !selectedClassId || !selectedTermId}>
              {generating ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Layers className="size-3.5 mr-1" />}
              {generating ? 'Generating...' : 'Generate'}
            </Button>
            {['pdf', 'csv', 'docx'].map((fmt) => (
              <Button key={fmt} size="sm" variant="outline" onClick={() => handleBulkExport(fmt)}
                disabled={!selectedClassId || !selectedTermId}>
                <Download className="size-3.5 mr-1" />{fmt.toUpperCase()}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
