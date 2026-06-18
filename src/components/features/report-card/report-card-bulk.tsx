'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Layers, Download, FileText, FileImage, FileSpreadsheet, File, AlertCircle, CheckCircle, Clock, Users } from 'lucide-react';
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
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportFormat, setExportFormat] = useState<string | null>(null);
  const [exportStats, setExportStats] = useState<any>(null);

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
    setExporting(true);
    setExportFormat(format);
    setExportProgress(0);
    setExportStats(null);
    
    try {
      const res = await fetch('/api/report-cards/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: selectedClassId, termId: selectedTermId, schoolId, format }),
      });
      if (!res.ok) throw new Error('Export failed');
      
      // For bulk exports, we need to handle progress tracking
      // Since the API doesn't return progress, we'll simulate it
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-cards-${selectedClassId}-${selectedTermId}.${format === 'pdf' ? 'zip' : format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error('Export failed');
      console.error('Export error:', error);
    } finally {
      setExporting(false);
      setExportFormat(null);
      setExportProgress(0);
    }
  };

  const getExportIcon = (format: string) => {
    switch (format) {
      case 'pdf': return <File className="size-3.5 mr-1" />;
      case 'csv': return <FileSpreadsheet className="size-3.5 mr-1" />;
      case 'docx': return <FileText className="size-3.5 mr-1" />;
      case 'png': return <FileImage className="size-3.5 mr-1" />;
      default: return <Download className="size-3.5 mr-1" />;
    }
  };

  const getExportColor = (format: string) => {
    switch (format) {
      case 'pdf': return 'text-red-600 bg-red-100';
      case 'csv': return 'text-green-600 bg-green-100';
      case 'docx': return 'text-blue-600 bg-blue-100';
      case 'png': return 'text-purple-600 bg-purple-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const exportOptions = [
    { format: 'pdf', label: 'PDF (ZIP)', icon: File, color: 'text-red-600 bg-red-100' },
    { format: 'csv', label: 'CSV', icon: FileSpreadsheet, color: 'text-green-600 bg-green-100' },
    { format: 'docx', label: 'DOCX', icon: FileText, color: 'text-blue-600 bg-blue-100' },
    { format: 'png', label: 'PNG (Single)', icon: FileImage, color: 'text-purple-600 bg-purple-100' },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Layers className="size-4" />Bulk Generate Report Cards
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Class</Label>
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
              <Label className="text-xs font-medium">Term</Label>
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

          {generating && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span>Generating report cards...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          <div className="space-y-3">
            <Button size="sm" onClick={handleBulkGenerate} disabled={generating || !selectedClassId || !selectedTermId} className="w-full md:w-auto">
              {generating ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Layers className="size-3.5 mr-1" />}
              {generating ? 'Generating...' : 'Generate Report Cards'}
            </Button>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Bulk Export</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {exportOptions.map((option) => (
                  <Button
                    key={option.format}
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkExport(option.format)}
                    disabled={exporting || !selectedClassId || !selectedTermId}
                    className="h-9 text-xs flex flex-col items-center gap-1 p-2"
                  >
                    {getExportIcon(option.format)}
                    <span>{option.label}</span>
                  </Button>
                ))}
              </div>
            </div>

            {exporting && exportFormat && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1">
                    <Loader2 className="size-3 animate-spin" />
                    Exporting as {exportFormat.toUpperCase()}...
                  </span>
                  <span>{exportProgress}%</span>
                </div>
                <Progress value={exportProgress} className="h-1.5" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {exportStats && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium flex items-center gap-2">
              <CheckCircle className="size-3.5" />Export Statistics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div className="flex items-center gap-1">
                <Users className="size-3.5 text-blue-600" />
                <span>Total: {exportStats.total}</span>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle className="size-3.5 text-green-600" />
                <span>Success: {exportStats.successful}</span>
              </div>
              <div className="flex items-center gap-1">
                <AlertCircle className="size-3.5 text-red-600" />
                <span>Failed: {exportStats.failed}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="size-3.5 text-purple-600" />
                <span>Time: {exportStats.time}ms</span>
              </div>
            </div>
            {exportStats.failedCards && exportStats.failedCards.length > 0 && (
              <div className="mt-2">
                <Label className="text-[10px] text-muted-foreground">Failed Cards:</Label>
                <div className="max-h-20 overflow-y-auto space-y-1 mt-1">
                  {exportStats.failedCards.slice(0, 3).map((card: any, idx: number) => (
                    <div key={idx} className="text-[10px] text-red-600 flex items-center gap-1">
                      <AlertCircle className="size-3" />
                      <span>{card.id}: {card.error}</span>
                    </div>
                  ))}
                  {exportStats.failedCards.length > 3 && (
                    <div className="text-[10px] text-muted-foreground">
                      ... and {exportStats.failedCards.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
