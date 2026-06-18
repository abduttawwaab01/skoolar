'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Save, RotateCcw, Eye, Table, ChartBarStacked, CircleUser, School as SchoolIcon } from 'lucide-react';
import { useReportCardStore } from '@/store/report-card-store';
import { ReportCardPreview } from './report-card-preview';

export function ReportCardDesigner() {
  const store = useReportCardStore();
  const { design, setDesign } = store;
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/report-card-designs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(design),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success('Design saved');
    } catch {
      toast.error('Failed to save design');
    } finally {
      setSaving(false);
    }
  }, [design]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-1 space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Report Card Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">

            {/* Sections */}
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium flex items-center gap-1.5 mb-1.5"><Eye className="size-3" />Visibility</p>
                <div className="space-y-1.5 pl-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs flex items-center gap-1.5"><SchoolIcon className="size-3 text-muted-foreground" />School Header</span>
                    <Switch checked={design.showHeader} onCheckedChange={(v) => setDesign({ showHeader: v })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs flex items-center gap-1.5"><CircleUser className="size-3 text-muted-foreground" />Student Info</span>
                    <Switch checked={design.showStudentInfo} onCheckedChange={(v) => setDesign({ showStudentInfo: v })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs flex items-center gap-1.5"><Table className="size-3 text-muted-foreground" />Subject Results</span>
                    <Switch checked={design.showSubjectsTable} onCheckedChange={(v) => setDesign({ showSubjectsTable: v })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs flex items-center gap-1.5"><ChartBarStacked className="size-3 text-muted-foreground" />Performance Chart</span>
                    <Switch checked={design.showChart} onCheckedChange={(v) => setDesign({ showChart: v })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs">Domain Assessment</span>
                    <Switch checked={design.showDomains} onCheckedChange={(v) => setDesign({ showDomains: v })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs">Cumulative Average</span>
                    <Switch checked={design.showCumulative} onCheckedChange={(v) => setDesign({ showCumulative: v })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs">Attendance</span>
                    <Switch checked={design.showAttendance} onCheckedChange={(v) => setDesign({ showAttendance: v })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs">Attendance Correlation</span>
                    <Switch checked={design.showCorrelation} onCheckedChange={(v) => setDesign({ showCorrelation: v })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs">Remarks & Signatures</span>
                    <Switch checked={design.showRemarks} onCheckedChange={(v) => setDesign({ showRemarks: v })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs">Watermark</span>
                    <Switch checked={design.showWatermark} onCheckedChange={(v) => setDesign({ showWatermark: v })} />
                  </div>
                  {design.showWatermark && (
                    <Input value={design.watermarkText} onChange={(e) => setDesign({ watermarkText: e.target.value })} placeholder="Watermark text" className="h-7 text-xs mt-1" />
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Colors */}
            <div>
              <p className="text-xs font-medium mb-1.5">Colors</p>
              <div className="grid grid-cols-4 gap-1.5">
                {([
                  ['primary', 'Primary'], ['secondary', 'Secondary'], ['accent', 'Accent'],
                  ['text', 'Text'], ['textSecondary', 'Muted'], ['headerBg', 'Header'],
                ] as const).map(([key, label]) => (
                  <div key={key} className="space-y-0.5">
                    <Label className="text-[9px] text-muted-foreground">{label}</Label>
                    <input type="color" value={(design.colors as any)[key] || '#000000'}
                      onChange={(e) => store.setDesignColors({ [key]: e.target.value })}
                      className="size-6 rounded border cursor-pointer p-0.5 w-full" />
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div className="flex gap-2">
              <Button size="sm" className="flex-1 h-7 text-xs" onClick={handleSave} disabled={saving}>
                <Save className="size-3 mr-1" />{saving ? 'Saving...' : 'Save'}
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { store.resetDesign(); }}>
                <RotateCcw className="size-3 mr-1" />Reset
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-2">
        <ReportCardPreview />
      </div>
    </div>
  );
}
