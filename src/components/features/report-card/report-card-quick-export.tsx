'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Download, FileImage, FileText, Table } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';

export function ReportCardQuickExport() {
  const { currentUser } = useAppStore();
  const schoolId = currentUser?.schoolId || '';
  const [selectedId, setSelectedId] = useState('');
  const [reportCards, setReportCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    fetch(`/api/report-cards?schoolId=${schoolId}&limit=50`)
      .then(r => r.json())
      .then(res => setReportCards(res.data || []))
      .catch(() => setReportCards([]))
      .finally(() => setLoading(false));
  }, [schoolId]);

  const handleExport = async (format: string) => {
    if (!selectedId) { toast.error('Select a report card'); return; }
    setExporting(true);
    try {
      const res = await fetch(`/api/report-cards/${selectedId}/pdf?format=${format}`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-card-${selectedId.slice(-8)}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded as ${format.toUpperCase()}`);
    } catch { toast.error('Export failed'); }
    finally { setExporting(false); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Download className="size-4" />Quick Export
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Report Card</Label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                {reportCards.map((rc: any) => (
                  <SelectItem key={rc.id} value={rc.id} className="text-xs">
                    {rc.student?.name || rc.student?.user?.name || 'N/A'} - {rc.term?.name} ({rc.grade || 'N/A'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={() => handleExport('pdf')} disabled={!selectedId || exporting}>
              {exporting ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <FileText className="size-3.5 mr-1" />}
              PDF
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleExport('png')} disabled={!selectedId || exporting}>
              <FileImage className="size-3.5 mr-1" />PNG
            </Button>
          </div>

          {reportCards.length === 0 && !loading && (
            <p className="text-xs text-muted-foreground text-center">No report cards available</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
