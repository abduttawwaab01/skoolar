'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, User, Download, Eye, FileText } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { cn } from '@/lib/utils';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  published: 'bg-emerald-100 text-emerald-700',
  archived: 'bg-red-100 text-red-700',
};

export function ReportCardView() {
  const { currentUser } = useAppStore();
  const schoolId = currentUser?.schoolId || '';

  const [classes, setClasses] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedTermId, setSelectedTermId] = useState('');
  const [reportCards, setReportCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  const fetchReportCards = useCallback(async () => {
    if (!selectedClassId || !selectedTermId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/report-cards?classId=${selectedClassId}&termId=${selectedTermId}&schoolId=${schoolId}`);
      const json = await res.json();
      setReportCards(json.data || []);
    } catch { setReportCards([]); }
    finally { setLoading(false); }
  }, [selectedClassId, selectedTermId, schoolId]);

  useEffect(() => { fetchReportCards(); }, [fetchReportCards]);

  const handleDownload = async (id: string, format: string) => {
    try {
      const res = await fetch(`/api/report-cards/${id}/pdf?format=${format}`);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-card-${id}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { console.error('Download failed'); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="size-4" />Generated Report Cards
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

          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin" /></div>
          ) : reportCards.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No report cards found</p>
          ) : (
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {reportCards.map((rc: any) => (
                <div key={rc.id} className={cn(
                  'flex items-center justify-between p-2 rounded-md border text-xs hover:bg-muted/50 cursor-pointer',
                  selectedId === rc.id && 'border-primary bg-primary/5'
                )} onClick={() => setSelectedId(rc.id)}>
                  <div className="flex items-center gap-2 min-w-0">
                    <User className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate font-medium">{rc.student?.name || rc.student?.user?.name || 'N/A'}</span>
                    <Badge variant="outline" className={cn('text-[9px]', STATUS_COLORS[rc.approvalStatus])}>
                      {rc.approvalStatus}
                    </Badge>
                    {rc.grade && <Badge variant="secondary" className="text-[9px]">{rc.grade}</Badge>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="size-6" onClick={(e) => { e.stopPropagation(); handleDownload(rc.id, 'pdf'); }}>
                      <Download className="size-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
