'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/store/app-store';
import { Skeleton } from '@/components/ui/skeleton';
import { IDCardRenderer } from '@/components/features/id-card/id-card-renderer';
import { Download, Printer, IdCard, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function TeacherIDCards() {
  const { currentUser } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [cards, setCards] = useState<any[]>([]);
  const [previewSide, setPreviewSide] = useState<'front' | 'back'>('front');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadTeacherData();
  }, [currentUser]);

  async function loadTeacherData() {
    setLoading(true);
    try {
      if (currentUser.role === 'TEACHER') {
        const statsRes = await fetch('/api/teachers/stats');
        if (statsRes.ok) {
          const statsJson = await statsRes.json();
          const tid = statsJson.data?.teacherId || null;
          setTeacherId(tid);
          if (tid) {
            const cardsRes = await fetch(`/api/id-cards?schoolId=${currentUser.schoolId}&personId=${tid}`);
            const cardsData = await cardsRes.json();
            setCards(cardsData.data || []);
          }
        }
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }

  const handleDownload = useCallback(async () => {
    if (!cards[0]?.id) return;
    setExporting(true);
    try {
      const res = await fetch(`/api/id-cards/${cards[0].id}/pdf`);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ID-Card-${cards[0].fullName.replace(/\s+/g, '-')}.html`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('ID Card downloaded');
    } catch {
      toast.error('Download failed');
    } finally {
      setExporting(false);
    }
  }, [cards]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full max-w-md rounded-lg" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <IdCard className="size-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">My ID Card</h2>
            <p className="text-sm text-muted-foreground">View and download your staff ID card</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleDownload} disabled={exporting || !cards.length}>
            {exporting ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Download className="size-3.5 mr-1" />}
            Download
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => window.print()}>
            <Printer className="size-3.5 mr-1" /> Print
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant={previewSide === 'front' ? 'default' : 'outline'}
          size="sm" onClick={() => setPreviewSide('front')}
          className="h-7 text-xs"
        >
          Front
        </Button>
        <Button
          variant={previewSide === 'back' ? 'default' : 'outline'}
          size="sm" onClick={() => setPreviewSide('back')}
          className="h-7 text-xs"
        >
          Back
        </Button>
      </div>

      {cards.length > 0 ? (
        <Card className="max-w-md">
          <CardContent className="p-6 flex flex-col items-center gap-4">
            <IDCardRenderer cardId={cards[0].id} side={previewSide} />
            <div className="text-xs text-muted-foreground">
              Card ID: {cards[0].uuid?.slice(0, 8).toUpperCase()} &middot; Status: <Badge variant="outline" className="text-[10px]">{cards[0].status}</Badge>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <IdCard className="size-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No ID card generated yet. Contact your school administrator.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
