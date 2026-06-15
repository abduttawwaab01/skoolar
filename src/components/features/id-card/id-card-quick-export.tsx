'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useIDCardStore } from '@/store/id-card-store';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import {
  Download, FileImage, FileText, Loader2, QrCode,
} from 'lucide-react';

type ExportFormat = 'png' | 'pdf';
type ExportScope = 'front' | 'back' | 'both';

export function IDCardQuickExport() {
  const { currentUser } = useAppStore();
  const store = useIDCardStore();
  const { personType, selectedPersonId, personData, design, photoFile, previewSrc } = store;
  const previewLoading = useIDCardStore((s) => s.previewLoading);

  const [format, setFormat] = useState<ExportFormat>('png');
  const [scope, setScope] = useState<ExportScope>('both');
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/id-cards/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format,
          scope,
          orientation: design.orientation,
          cards: [{
            type: personType,
            personId: selectedPersonId || 'preview',
            name: personData.fullName || 'Unknown',
            displayId: personData.displayId || 'N/A',
            role: personData.role,
            class: personData.className || personData.department,
            photo: photoFile,
            userId: currentUser.id,
          }],
        }),
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const ext = format === 'pdf' ? 'pdf' : 'zip';
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `ID-Card-${personData.fullName || 'Card'}.${ext}`;
      link.click();
      toast.success(`${format.toUpperCase()} downloaded`);
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-[10px] font-medium">Export Format</Label>
        <div className="grid grid-cols-2 gap-1.5">
          <Button
            variant={format === 'png' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFormat('png')}
            className="h-7 text-[10px]"
          >
            <FileImage className="size-3 mr-1" /> PNG
          </Button>
          <Button
            variant={format === 'pdf' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFormat('pdf')}
            className="h-7 text-[10px]"
          >
            <FileText className="size-3 mr-1" /> PDF
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[10px] font-medium">Scope</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {(['front', 'back', 'both'] as const).map((s) => (
            <Button
              key={s}
              variant={scope === s ? 'default' : 'outline'}
              size="sm"
              onClick={() => setScope(s)}
              className="h-7 text-[10px] capitalize"
            >
              {s === 'both' ? 'Both Sides' : s}
            </Button>
          ))}
        </div>
      </div>

      <Separator />

      <div className="space-y-1.5">
        <Label className="text-[10px] font-medium">QR Code Action</Label>
        <div className="flex items-center gap-2">
          <QrCode className="size-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">
            Scanned QR will mark attendance
          </span>
        </div>
      </div>

      <Separator />

      <Button
        onClick={handleExport}
        disabled={exporting || (!previewSrc && !previewLoading)}
        className="w-full h-8 text-xs"
        size="sm"
      >
        {exporting ? (
          <Loader2 className="size-3 animate-spin mr-1.5" />
        ) : (
          <Download className="size-3.5 mr-1.5" />
        )}
        Export {format.toUpperCase()}
      </Button>

      {!previewSrc && !previewLoading && (
        <p className="text-[9px] text-muted-foreground text-center">
          Design a card first before exporting
        </p>
      )}
    </div>
  );
}
