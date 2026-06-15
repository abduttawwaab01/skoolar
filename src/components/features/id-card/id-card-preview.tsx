'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { useIDCardStore } from '@/store/id-card-store';
import { Loader2, ImageOff } from 'lucide-react';

export function IDCardPreview() {
  const previewSrc = useIDCardStore((s) => s.previewSrc);
  const previewLoading = useIDCardStore((s) => s.previewLoading);
  const orientation = useIDCardStore((s) => s.design.orientation);

  return (
    <div
      data-card-preview
      className={cn(
        'relative flex items-center justify-center rounded-xl border-2 border-dashed bg-muted/30 transition-all',
        orientation === 'landscape' ? 'w-[342px] h-[216px]' : 'w-[216px] h-[342px]'
      )}
    >
      {previewLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 rounded-xl">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {previewSrc ? (
        <img
          src={previewSrc}
          alt="ID Card Preview"
          className="w-full h-full object-contain rounded-xl"
        />
      ) : (
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <ImageOff className="size-8" />
          <span className="text-xs">No preview available</span>
          <span className="text-[10px]">Fill in card details and wait for auto-refresh</span>
        </div>
      )}
    </div>
  );
}
