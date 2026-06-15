'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/store/app-store';
import { Loader2, Download, Printer, User, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export function IDCardMyCard() {
  const { currentUser } = useAppStore();
  const [card, setCard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/id-cards?type=self&userId=${currentUser.id}`);
        if (res.ok) {
          const json = await res.json();
          if (json.data?.length > 0) {
            setCard(json.data[0]);
          } else {
            setError('No ID card found. Contact your school administrator.');
          }
        } else {
          setError('Failed to load your ID card');
        }
      } catch {
        setError('Network error loading card');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [currentUser.id]);

  const handleDownload = async (format: 'png' | 'pdf') => {
    if (!card) return;
    try {
      const res = await fetch('/api/id-cards/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format,
          scope: 'both',
          orientation: card.orientation || 'landscape',
          cards: [{
            personId: card.id,
            userId: currentUser.id,
            name: currentUser.name,
            displayId: card.displayId || 'N/A',
            role: currentUser.role,
            type: card.personType || 'staff',
          }],
        }),
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `My-ID-Card.${format === 'pdf' ? 'pdf' : 'png'}`;
      link.click();
      toast.success(`${format.toUpperCase()} downloaded`);
    } catch {
      toast.error('Download failed');
    }
  };

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) { toast.error('Popup blocked'); return; }
    win.document.write(`<img src="${card?.cardImage || ''}" style="max-width:100%;" onload="window.print();window.close();" />`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle className="size-10 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className="flex items-center gap-2">
        <User className="size-4" />
        <span className="text-sm font-medium">{currentUser.name}</span>
        <Badge variant="outline" className="text-[10px]">
          {currentUser.role?.replace('_', ' ')}
        </Badge>
      </div>

      {card?.cardImage || card?.previewImage ? (
        <Card className="overflow-hidden border-2 shadow-lg">
          <CardContent className="p-0">
            <img
              src={card.cardImage || card.previewImage}
              alt="Your ID Card"
              className="max-w-full h-auto"
              style={{ maxHeight: '400px' }}
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="w-[342px] h-[216px] flex items-center justify-center border-dashed">
          <CardContent>
            <p className="text-xs text-muted-foreground">Card image not available</p>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => handleDownload('png')} className="h-8 text-xs">
          <Download className="size-3.5 mr-1.5" /> PNG
        </Button>
        <Button size="sm" onClick={() => handleDownload('pdf')} className="h-8 text-xs">
          <Download className="size-3.5 mr-1.5" /> PDF
        </Button>
        <Button size="sm" variant="outline" onClick={handlePrint} className="h-8 text-xs">
          <Printer className="size-3.5 mr-1.5" /> Print
        </Button>
      </div>

      {card?.uuid && (
        <p className="text-[10px] text-muted-foreground">
          Card ID: {card.uuid}
        </p>
      )}
    </div>
  );
}
