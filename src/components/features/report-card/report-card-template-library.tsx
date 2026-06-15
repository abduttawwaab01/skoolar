'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LayoutTemplate, Check, Sparkles } from 'lucide-react';
import { DEFAULT_TEMPLATES } from '@/lib/report-card-utils/default-templates';
import { useReportCardStore } from '@/store/report-card-store';
import { cn } from '@/lib/utils';

interface Props {
  onSelect?: () => void;
}

export function ReportCardTemplateLibrary({ onSelect }: Props) {
  const selectedPresetId = useReportCardStore((s) => s.selectedPresetId);
  const applyPreset = useReportCardStore((s) => s.applyPreset);
  const setSelectedPresetId = useReportCardStore((s) => s.setSelectedPresetId);

  const categories = Array.from(new Set(DEFAULT_TEMPLATES.map((t) => t.category)));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <LayoutTemplate className="size-5 text-primary" />
        <h3 className="text-sm font-medium">Template Library</h3>
        <Badge variant="secondary" className="text-[10px]">{DEFAULT_TEMPLATES.length} presets</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {DEFAULT_TEMPLATES.map((preset) => (
          <Card key={preset.id} className={cn(
            'cursor-pointer transition-all hover:border-primary/50',
            selectedPresetId === preset.id && 'border-primary ring-1 ring-primary'
          )} onClick={() => { applyPreset(preset); setSelectedPresetId(preset.id); onSelect?.(); }}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-xs font-medium">{preset.name}</CardTitle>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{preset.category}</p>
                </div>
                {selectedPresetId === preset.id && <Check className="size-4 text-primary" />}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-[10px] text-muted-foreground line-clamp-2">{preset.description}</p>
              <div className="flex gap-1 mt-2 flex-wrap">
                <Badge variant="outline" className="text-[9px]">{preset.orientation}</Badge>
                <Badge variant="outline" className="text-[9px]" style={{ backgroundColor: preset.colors?.primary + '20', color: preset.colors?.primary }}>
                  {preset.fontFamily}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
