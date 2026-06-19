'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';
import { Loader2, Download, Users, GraduationCap, UserCheck, Building2, CheckCircle, DownloadCloud } from 'lucide-react';

type BulkType = 'student' | 'teacher' | 'staff';

const TYPE_OPTIONS: { value: BulkType; label: string; icon: React.ElementType; desc: string }[] = [
  { value: 'student', label: 'Students', icon: GraduationCap, desc: 'Generate cards for all students or filter by class' },
  { value: 'teacher', label: 'Teachers', icon: UserCheck, desc: 'Generate cards for all teaching staff' },
  { value: 'staff', label: 'Staff & Admin', icon: Building2, desc: 'Generate cards for non-teaching staff & admins' },
];

export function IDCardBulk() {
  const { currentUser } = useAppStore();
  const [step, setStep] = useState<'select' | 'generating' | 'done'>('select');
  const [selectedClass, setSelectedClass] = useState('');
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [personType, setPersonType] = useState<BulkType>('student');
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [generated, setGenerated] = useState<Array<{ id: string; fullName: string; displayId: string; personId: string }>>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [exportingAll, setExportingAll] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    if (personType !== 'student') { setClasses([]); return; }
    fetchClasses();
  }, [personType, currentUser?.schoolId]);

  async function fetchClasses() {
    if (!currentUser?.schoolId) return;
    setLoadingClasses(true);
    try {
      const res = await fetch(`/api/classes?schoolId=${currentUser.schoolId}&limit=100`);
      const data = await res.json();
      setClasses(data.data || data || []);
    } catch {
      setClasses([]);
    } finally {
      setLoadingClasses(false);
    }
  }

  const handleGenerate = useCallback(async () => {
    setStep('generating');
    setProgress(0);
    try {
      const typesToProcess = personType === 'staff' ? ['teacher'] : [personType];
      let allCards: Array<{ id: string; fullName: string; displayId: string; personId: string }> = [];
      let totalCount = 0;

      for (let i = 0; i < typesToProcess.length; i++) {
        const res = await fetch('/api/id-cards/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            personType: typesToProcess[i],
            classId: typesToProcess[i] === 'student' ? selectedClass || undefined : undefined,
          }),
        });
        if (!res.ok) throw new Error('Generation failed');
        const result = await res.json();
        allCards = [...allCards, ...(result.data || [])];
        totalCount += result.count || 0;
        setProgress(Math.round(((i + 1) / typesToProcess.length) * 100));
      }

      setGenerated(allCards);
      setTotal(totalCount);
      setProgress(100);
      setStep('done');
      toast.success(`Generated ${totalCount} ID card${totalCount !== 1 ? 's' : ''}`);
    } catch {
      toast.error('Bulk generation failed');
      setStep('select');
    }
  }, [personType, selectedClass]);

  const downloadCard = useCallback(async (cardId: string, personName: string) => {
    setDownloadingId(cardId);
    try {
      const res = await fetch(`/api/id-cards/${cardId}/pdf`);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ID-Card-${personName.replace(/\s+/g, '-')}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed');
    } finally {
      setDownloadingId(null);
    }
  }, []);

  const handleExportAll = useCallback(async () => {
    if (generated.length === 0) return;
    setExportingAll(true);
    try {
      const res = await fetch('/api/id-cards/export/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: currentUser?.schoolId || '',
          personIds: generated.map(c => c.personId),
        }),
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ID-Cards-${personType}.html`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Exported all cards');
    } catch {
      toast.error('Export failed');
    } finally {
      setExportingAll(false);
    }
  }, [generated, personType, currentUser?.schoolId]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Bulk ID Card Generation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 'select' && (
            <>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Card Type</Label>
                <div className="grid grid-cols-3 gap-2">
                  {TYPE_OPTIONS.map(({ value, label, icon: Icon, desc }) => (
                    <Button
                      key={value}
                      variant={personType === value ? 'default' : 'outline'}
                      size="sm" onClick={() => setPersonType(value)}
                      className="flex flex-col items-center gap-1 h-auto py-2.5 text-xs"
                    >
                      <Icon className="size-4" />
                      <span className="font-medium">{label}</span>
                      <span className="text-[9px] opacity-70 font-normal">{desc.split('.')[0]}</span>
                    </Button>
                  ))}
                </div>
              </div>

              {personType === 'student' && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Class Filter (optional)</Label>
                  <select
                    value={selectedClass}
                    onChange={e => setSelectedClass(e.target.value)}
                    className="flex h-8 w-full rounded-md border border-input bg-background px-3 text-xs"
                  >
                    <option value="">All Classes</option>
                    {loadingClasses ? (
                      <option disabled>Loading classes...</option>
                    ) : classes.length === 0 ? (
                      <option disabled>No classes found</option>
                    ) : (
                      classes.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.name || c.className || c.class_name}</option>
                      ))
                    )}
                  </select>
                </div>
              )}

              <Separator />
              <Button onClick={handleGenerate} size="sm" className="w-full h-8 text-xs">
                <Users className="size-3.5 mr-1.5" /> Generate Cards
              </Button>
            </>
          )}

          {step === 'generating' && (
            <div className="space-y-3 py-4 text-center">
              <Loader2 className="size-6 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">Generating ID cards...</p>
              <Progress value={progress} className="h-1.5" />
            </div>
          )}

          {step === 'done' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant="default" className="text-xs">{total} card{total !== 1 ? 's' : ''} generated</Badge>
                <div className="flex gap-1.5">
                  <Button size="sm" className="h-7 text-[10px]" onClick={handleExportAll} disabled={exportingAll || generated.length === 0}>
                    {exportingAll ? <Loader2 className="size-3 animate-spin mr-1" /> : <DownloadCloud className="size-3 mr-1" />}
                    {exportingAll ? 'Exporting...' : 'Export All'}
                  </Button>
                  <Button onClick={() => { setStep('select'); setGenerated([]); }} variant="outline" size="sm" className="h-7 text-[10px]">
                    Generate More
                  </Button>
                </div>
              </div>

              {generated.length > 0 && (
                <div className="max-h-64 overflow-y-auto border rounded-lg">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-gray-50/80">
                        <th className="text-left p-2.5 font-semibold text-gray-600">Name</th>
                        <th className="text-left p-2.5 font-semibold text-gray-600">ID</th>
                        <th className="text-right p-2.5 font-semibold text-gray-600">Download</th>
                      </tr>
                    </thead>
                    <tbody>
                      {generated.map(card => (
                        <tr key={card.id} className="border-b border-gray-100">
                          <td className="p-2.5 font-medium">{card.fullName || card.displayId}</td>
                          <td className="p-2.5 text-gray-500">{card.displayId || '-'}</td>
                          <td className="p-2.5 text-right">
                            <Button
                              size="sm" variant="ghost"
                              className="h-6 text-[10px] text-indigo-600"
                              onClick={() => downloadCard(card.id, card.fullName)}
                              disabled={downloadingId === card.id}
                            >
                              {downloadingId === card.id ? <Loader2 className="size-3 animate-spin mr-1" /> : <Download className="size-3 mr-1" />}
                              {downloadingId === card.id ? '...' : 'Download'}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
