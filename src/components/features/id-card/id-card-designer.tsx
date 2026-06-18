'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useIDCardStore } from '@/store/id-card-store';
import { IDCardPreview } from './id-card-preview';
import { RotateCcw, Save, Palette, Eye, EyeOff, QrCode, Image, Type, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

const COLOR_THEMES = [
  { name: 'Emerald', primary: '#059669', secondary: '#34d399', accent: '#fbbf24', headerBg: '#059669', gradient: 'from-emerald-600 to-emerald-500' },
  { name: 'Royal Blue', primary: '#1d4ed8', secondary: '#60a5fa', accent: '#f59e0b', headerBg: '#1d4ed8', gradient: 'from-blue-600 to-blue-500' },
  { name: 'Crimson', primary: '#dc2626', secondary: '#f87171', accent: '#fcd34d', headerBg: '#dc2626', gradient: 'from-red-600 to-red-500' },
  { name: 'Purple', primary: '#7c3aed', secondary: '#a78bfa', accent: '#34d399', headerBg: '#7c3aed', gradient: 'from-purple-600 to-purple-500' },
  { name: 'Teal', primary: '#0d9488', secondary: '#5eead4', accent: '#fbbf24', headerBg: '#0d9488', gradient: 'from-teal-600 to-teal-500' },
  { name: 'Amber', primary: '#d97706', secondary: '#fbbf24', accent: '#3b82f6', headerBg: '#d97706', gradient: 'from-amber-600 to-amber-500' },
  { name: 'Slate', primary: '#334155', secondary: '#94a3b8', accent: '#0ea5e9', headerBg: '#334155', gradient: 'from-slate-600 to-slate-500' },
];

export function IDCardDesigner() {
  const { design, setDesign, setDesignColors, resetDesign, previewSide } = useIDCardStore();
  const [activeSection, setActiveSection] = useState('content');
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<string>('');

  useEffect(() => {
    loadPreview();
  }, [design, previewSide, selectedStudent]);

  const loadPreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const res = await fetch('/api/id-cards/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: '',
          studentId: selectedStudent || undefined,
          side: previewSide,
        }),
      });
      if (res.ok) {
        const html = await res.text();
        setPreviewHtml(html);
      } else {
        setPreviewHtml(null);
      }
    } catch {
      setPreviewHtml(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [previewSide, selectedStudent]);

  const applyTheme = useCallback((theme: typeof COLOR_THEMES[0]) => {
    setDesignColors({
      primary: theme.primary,
      secondary: theme.secondary,
      accent: theme.accent,
      headerBg: theme.headerBg,
    });
    toast.success(`Theme: ${theme.name}`);
  }, [setDesignColors]);

  const saveDesign = useCallback(async () => {
    try {
      const res = await fetch('/api/id-card-designs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: design.name,
          orientation: design.orientation,
          primaryColor: design.colors.primary,
          secondaryColor: design.colors.secondary,
          accentColor: design.colors.accent,
          textColor: design.colors.text,
          textSecondaryColor: design.colors.textSecondary,
          headerBgColor: design.colors.headerBg,
          bgColor: design.colors.bg,
          backgroundType: design.backgroundType,
          fontFamily: design.fontFamily,
          fontSize: design.fontSize,
          showPhoto: design.showPhoto,
          showLogo: design.showLogo,
          showQRCode: design.showQRCode,
          showBarcode: design.showBarcode,
          showSignature: design.showSignature,
          showWatermark: design.showWatermark,
          showExpiryDate: design.showExpiryDate,
          showIssueDate: design.showIssueDate,
          showMotto: design.showMotto,
          showAddress: design.showAddress,
          showEmergencyInfo: design.showEmergencyInfo,
          showMedicalInfo: design.showMedicalInfo,
          showTerms: design.showTerms,
          watermarkText: design.watermarkText,
          backText: design.backText,
        }),
      });
      if (res.ok) {
        toast.success('Design saved successfully');
      } else {
        toast.error('Failed to save design');
      }
    } catch {
      toast.error('Failed to save design');
    }
  }, [design]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-4">
      <div className="space-y-3 max-h-[calc(100vh-180px)] overflow-y-auto pr-1">
        <Tabs value={activeSection} onValueChange={setActiveSection}>
          <TabsList className="w-full grid grid-cols-4 h-8">
            <TabsTrigger value="content" className="text-[10px]"><Type className="size-3 mr-1" />Content</TabsTrigger>
            <TabsTrigger value="design" className="text-[10px]"><Palette className="size-3 mr-1" />Design</TabsTrigger>
            <TabsTrigger value="back" className="text-[10px]"><Layers className="size-3 mr-1" />Back</TabsTrigger>
            <TabsTrigger value="elements" className="text-[10px]"><Eye className="size-3 mr-1" />Elements</TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-2.5 mt-2">
            <Card className="p-3 space-y-2">
              <Label className="text-[10px] font-semibold">Orientation</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={design.orientation === 'landscape' ? 'default' : 'outline'}
                  size="sm" onClick={() => setDesign({ orientation: 'landscape' })}
                  className="h-7 text-xs"
                >
                  Landscape
                </Button>
                <Button
                  variant={design.orientation === 'portrait' ? 'default' : 'outline'}
                  size="sm" onClick={() => setDesign({ orientation: 'portrait' })}
                  className="h-7 text-xs"
                >
                  Portrait
                </Button>
              </div>
            </Card>

            <Card className="p-3 space-y-2">
              <Label className="text-[10px] font-semibold">Card Type</Label>
              <div className="grid grid-cols-2 gap-2">
                {(['student', 'teacher'] as const).map(t => (
                  <Button
                    key={t}
                    variant={design.type === t ? 'default' : 'outline'}
                    size="sm" onClick={() => setDesign({ type: t })}
                    className="h-7 text-xs"
                  >
                    {t === 'student' ? 'Student' : 'Staff'}
                  </Button>
                ))}
              </div>
            </Card>

            <Card className="p-3 space-y-2">
              <Label className="text-[10px] font-semibold">Preview Student (optional)</Label>
              <Input
                placeholder="Student ID to preview"
                value={selectedStudent}
                onChange={e => setSelectedStudent(e.target.value)}
                className="h-7 text-xs"
              />
            </Card>
          </TabsContent>

          <TabsContent value="design" className="space-y-2.5 mt-2">
            <Card className="p-3 space-y-3">
              <Label className="text-[10px] font-semibold">Color Themes</Label>
              <div className="grid grid-cols-4 gap-1.5">
                {COLOR_THEMES.map(t => (
                  <button
                    key={t.name}
                    type="button"
                    title={t.name}
                    onClick={() => applyTheme(t)}
                    className={cn(
                      'w-full aspect-[2/1] rounded-md border-2 transition-all',
                      design.colors.primary === t.primary ? 'border-foreground ring-1 ring-foreground scale-105' : 'border-transparent hover:border-gray-300'
                    )}
                  >
                    <div className={`w-full h-full rounded-[3px] bg-gradient-to-r ${t.gradient}`} />
                  </button>
                ))}
              </div>
              <Separator />
              <Label className="text-[10px] font-semibold">Background</Label>
              <div className="grid grid-cols-2 gap-1">
                {(['solid', 'dots', 'grid', 'glass'] as const).map(bg => (
                  <Button
                    key={bg}
                    variant={design.backgroundType === bg ? 'default' : 'outline'}
                    size="sm" onClick={() => setDesign({ backgroundType: bg })}
                    className="h-6 text-[9px] capitalize"
                  >
                    {bg}
                  </Button>
                ))}
              </div>
              <Separator />
              <div className="space-y-2">
                <Label className="text-[10px] font-semibold">Custom Colors</Label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { key: 'primary', label: 'Primary' },
                    { key: 'headerBg', label: 'Header' },
                    { key: 'accent', label: 'Accent' },
                  ] as const).map(({ key, label }) => (
                    <div key={key} className="space-y-1">
                      <Label className="text-[8px]">{label}</Label>
                      <input
                        type="color"
                        value={design.colors[key]}
                        onChange={e => setDesignColors({ [key]: e.target.value })}
                        className="w-full h-6 rounded cursor-pointer"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="back" className="space-y-2.5 mt-2">
            <Card className="p-3 space-y-2">
              <Label className="text-[10px] font-semibold">Back Content</Label>
              <Textarea
                value={design.backText}
                onChange={e => setDesign({ backText: e.target.value })}
                className="min-h-[120px] text-xs"
                placeholder="Terms, rules, and instructions for the back of the card..."
              />
            </Card>
          </TabsContent>

          <TabsContent value="elements" className="space-y-2.5 mt-2">
            <Card className="p-3 space-y-3">
              {[
                { key: 'showPhoto' as const, label: 'Photo' },
                { key: 'showLogo' as const, label: 'School Logo' },
                { key: 'showQRCode' as const, label: 'QR Code' },
                { key: 'showBarcode' as const, label: 'Barcode' },
                { key: 'showSignature' as const, label: 'Signature' },
                { key: 'showWatermark' as const, label: 'Watermark' },
                { key: 'showMotto' as const, label: 'School Motto' },
                { key: 'showAddress' as const, label: 'Address' },
                { key: 'showExpiryDate' as const, label: 'Expiry Date' },
                { key: 'showIssueDate' as const, label: 'Issue Date' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <Label className="text-xs">{label}</Label>
                  <Switch
                    checked={design[key]}
                    onCheckedChange={v => setDesign({ [key]: v })}
                  />
                </div>
              ))}
            </Card>

            <Card className="p-3 space-y-2">
              <Label className="text-[10px] font-semibold">Back Section Visibility</Label>
              {[
                { key: 'showEmergencyInfo' as const, label: 'Emergency Info' },
                { key: 'showMedicalInfo' as const, label: 'Medical Info' },
                { key: 'showTerms' as const, label: 'Terms & Rules' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <Label className="text-xs">{label}</Label>
                  <Switch
                    checked={design[key]}
                    onCheckedChange={v => setDesign({ [key]: v })}
                  />
                </div>
              ))}
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex gap-2 pt-2">
          <Button onClick={saveDesign} size="sm" className="flex-1 h-7 text-xs">
            <Save className="size-3 mr-1" /> Save Design
          </Button>
          <Button onClick={resetDesign} variant="outline" size="sm" className="h-7 text-xs">
            <RotateCcw className="size-3 mr-1" /> Reset
          </Button>
        </div>
      </div>

      <div className="flex flex-col items-center justify-start pt-4">
        <IDCardPreview previewHtml={previewHtml} loading={previewLoading} />
      </div>
    </div>
  );
}
