'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/store/app-store';
import { Skeleton } from '@/components/ui/skeleton';
import { IDCardRenderer } from '@/components/features/id-card/id-card-renderer';
import { IdCard, Download, Printer } from 'lucide-react';
import { toast } from 'sonner';

export function ParentIDCards() {
  const { currentUser } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [cardsByChild, setCardsByChild] = useState<Record<string, any>>({});
  const [previewSide, setPreviewSide] = useState<'front' | 'back'>('front');

  useEffect(() => {
    loadChildren();
  }, [currentUser]);

  async function loadChildren() {
    setLoading(true);
    try {
      const res = await fetch(`/api/parents?schoolId=${currentUser.schoolId}&userId=${currentUser.id}`);
      const data = await res.json();
      const childrenList = data.data?.[0]?.children || [];
      setChildren(childrenList);

      if (childrenList.length > 0) {
        setSelectedChild(childrenList[0].id);
        for (const child of childrenList) {
          const cardsRes = await fetch(`/api/id-cards?schoolId=${currentUser.schoolId}&personId=${child.id}&personType=student`);
          const cardsData = await cardsRes.json();
          if (cardsData.data?.length > 0) {
            setCardsByChild(prev => ({ ...prev, [child.id]: cardsData.data[0] }));
          }
        }
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full max-w-md rounded-lg" />
      </div>
    );
  }

  const selectedCard = selectedChild ? cardsByChild[selectedChild] : null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <IdCard className="size-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Children ID Cards</h2>
          <p className="text-sm text-muted-foreground">View and download ID cards for your children</p>
        </div>
      </div>

      {children.length > 1 && (
        <Tabs value={selectedChild || ''} onValueChange={setSelectedChild}>
          <TabsList>
            {children.map((child: any) => (
              <TabsTrigger key={child.id} value={child.id} className="text-xs">
                {child.user?.name || child.id}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

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

      {selectedCard ? (
        <Card className="max-w-md">
          <CardContent className="p-6 flex flex-col items-center gap-4">
            <IDCardRenderer
              cardId={selectedCard.id}
              side={previewSide}
            />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={async () => {
                try {
                  const res = await fetch(`/api/id-cards/${selectedCard.id}/pdf`);
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `ID-Card-${selectedCard.fullName}.html`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success('Downloaded');
                } catch {
                  toast.error('Download failed');
                }
              }}>
                <Download className="size-3 mr-1" /> Download
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => window.print()}>
                <Printer className="size-3 mr-1" /> Print
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <IdCard className="size-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No ID cards available for your children yet.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
