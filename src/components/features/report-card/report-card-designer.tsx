'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { RotateCcw, Palette, Eye } from 'lucide-react';
import { useReportCardStore } from '@/store/report-card-store';

const COLOR_THEMES = [
  { name: 'Emerald', primary: '#059669', headerBg: '#059669', accent: '#fbbf24' },
  { name: 'Indigo', primary: '#4f46e5', headerBg: '#4338ca', accent: '#f59e0b' },
  { name: 'Crimson', primary: '#dc2626', headerBg: '#b91c1c', accent: '#fcd34d' },
  { name: 'Purple', primary: '#7c3aed', headerBg: '#6d28d9', accent: '#34d399' },
  { name: 'Teal', primary: '#0d9488', headerBg: '#0f766e', accent: '#fbbf24' },
  { name: 'Amber', primary: '#d97706', headerBg: '#b45309', accent: '#3b82f6' },
];

export function ReportCardDesigner() {
  const { design, setDesign, setDesignColors, resetDesign } = useReportCardStore();

  const applyTheme = (theme: typeof COLOR_THEMES[0]) => {
    setDesignColors({ primary: theme.primary, headerBg: theme.headerBg, accent: theme.accent });
  };

  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 pb-1">
            <Palette className="size-4 text-indigo-600" />
            <h3 className="text-sm font-semibold">Card Designer</h3>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-semibold">Color Themes</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {COLOR_THEMES.map(t => (
                <button
                  key={t.name}
                  type="button"
                  title={t.name}
                  onClick={() => applyTheme(t)}
                  className={`w-full aspect-[2/1] rounded-md border-2 transition-all ${
                    design.colors.primary === t.primary ? 'border-foreground ring-1 ring-foreground scale-105' : 'border-transparent hover:border-gray-300'
                  }`}
                >
                  <div className="w-full h-full rounded flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${t.primary}, ${t.headerBg})` }}>
                    <span className="text-white text-[7px] font-bold">{t.name}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-[8px]">Primary</Label>
              <input type="color" value={design.colors.primary} onChange={e => setDesignColors({ primary: e.target.value })} className="w-full h-6 rounded cursor-pointer" />
            </div>
            <div className="space-y-1">
              <Label className="text-[8px]">Header</Label>
              <input type="color" value={design.colors.headerBg} onChange={e => setDesignColors({ headerBg: e.target.value })} className="w-full h-6 rounded cursor-pointer" />
            </div>
            <div className="space-y-1">
              <Label className="text-[8px]">Accent</Label>
              <input type="color" value={design.colors.accent} onChange={e => setDesignColors({ accent: e.target.value })} className="w-full h-6 rounded cursor-pointer" />
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px]">Orientation</Label>
              <select
                value={design.orientation}
                onChange={e => setDesign({ orientation: e.target.value as 'portrait' | 'landscape' })}
                className="w-full h-7 text-xs border rounded px-2 bg-background"
              >
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Font Size</Label>
              <select
                value={design.fontSize}
                onChange={e => setDesign({ fontSize: e.target.value as 'sm' | 'md' | 'lg' })}
                className="w-full h-7 text-xs border rounded px-2 bg-background"
              >
                <option value="sm">Small</option>
                <option value="md">Medium</option>
                <option value="lg">Large</option>
              </select>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="text-[10px] font-semibold flex items-center gap-1"><Eye className="size-3" /> Element Visibility</Label>
            {[
              { key: 'showHeader' as const, label: 'School Header' },
              { key: 'showLogo' as const, label: 'School Logo' },
              { key: 'showStudentInfo' as const, label: 'Student Info' },
              { key: 'showSubjectsTable' as const, label: 'Subject Results Table' },
              { key: 'showDomains' as const, label: 'Domain Assessment' },
              { key: 'showChart' as const, label: 'Performance Chart' },
              { key: 'showAttendance' as const, label: 'Attendance Summary' },
              { key: 'showRemarks' as const, label: 'Teacher & Principal Comments' },
              { key: 'showWatermark' as const, label: 'Watermark' },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between p-1.5 rounded hover:bg-gray-50">
                <Label className="text-xs cursor-pointer">{label}</Label>
                <Switch checked={design[key]} onCheckedChange={v => setDesign({ [key]: v })} />
              </div>
            ))}
          </div>

          <Separator />

          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs flex-1" onClick={resetDesign}>
              <RotateCcw className="size-3 mr-1" /> Reset
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
