'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Palette, Type, Layout, Image, Eye, Save, RotateCcw, Sparkles, FileImage } from 'lucide-react';
import { useReportCardStore } from '@/store/report-card-store';
import { useAppStore } from '@/store/app-store';
import { DEFAULT_TEMPLATES } from '@/lib/report-card-utils/default-templates';
import { cn } from '@/lib/utils';

export function ReportCardDesigner() {
  const store = useReportCardStore();
  const { currentUser } = useAppStore();
  const { design, setDesign, setDesignColors, applyPreset, setSelectedPresetId, selectedPresetId } = store;
  const [activeSection, setActiveSection] = useState('layout');
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/report-card-designs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: design.name, ...design }),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success('Design saved');
    } catch {
      toast.error('Failed to save design');
    } finally {
      setSaving(false);
    }
  }, [design]);

  const applyPresetHandler = useCallback((presetId: string) => {
    const preset = DEFAULT_TEMPLATES.find(p => p.id === presetId);
    if (preset) { applyPreset(preset); setSelectedPresetId(presetId); }
  }, [applyPreset, setSelectedPresetId]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-1 space-y-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Design Settings</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Preset Template</Label>
              <Select value={selectedPresetId} onValueChange={applyPresetHandler}>
                <SelectTrigger><SelectValue placeholder="Select preset..." /></SelectTrigger>
                <SelectContent>
                  {DEFAULT_TEMPLATES.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Design Name</Label>
              <Input value={design.name} onChange={(e) => setDesign({ name: e.target.value })} placeholder="My Design" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Orientation</Label>
              <Select value={design.orientation} onValueChange={(v: any) => setDesign({ orientation: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="portrait">Portrait</SelectItem>
                  <SelectItem value="landscape">Landscape</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Font Family</Label>
              <Select value={design.fontFamily} onValueChange={(v) => setDesign({ fontFamily: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Inter">Inter</SelectItem>
                  <SelectItem value="Arial">Arial</SelectItem>
                  <SelectItem value="Georgia">Georgia</SelectItem>
                  <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Font Size</Label>
              <Select value={design.fontSize} onValueChange={(v: any) => setDesign({ fontSize: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sm">Small</SelectItem>
                  <SelectItem value="md">Medium</SelectItem>
                  <SelectItem value="lg">Large</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <Tabs value={activeSection} onValueChange={setActiveSection}>
              <TabsList className="grid grid-cols-3 h-8">
                <TabsTrigger value="layout" className="text-xs"><Layout className="size-3 mr-1" />Layout</TabsTrigger>
                <TabsTrigger value="colors" className="text-xs"><Palette className="size-3 mr-1" />Colors</TabsTrigger>
                <TabsTrigger value="content" className="text-xs"><Image className="size-3 mr-1" />Content</TabsTrigger>
              </TabsList>

              <TabsContent value="layout" className="space-y-2 mt-2">
                {([
                  ['showHeader', 'Header'], ['showLogo', 'Logo'], ['showMotto', 'Motto'],
                  ['showAddress', 'Address'], ['showContacts', 'Contacts'],
                  ['showStudentInfo', 'Student Info'], ['showSubjectsTable', 'Subjects Table'],
                  ['showDomains', 'Domains'], ['showChart', 'Chart'], ['showAttendance', 'Attendance'],
                  ['showRemarks', 'Remarks'], ['showSignatures', 'Signatures'],
                  ['showFooter', 'Footer'], ['showWatermark', 'Watermark'],
                ] as const).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-xs">{label}</span>
                    <Switch checked={(design as any)[key]} onCheckedChange={(v) => setDesign({ [key]: v } as any)} />
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="colors" className="space-y-2 mt-2">
                {([
                  ['primary', 'Primary'], ['secondary', 'Secondary'], ['accent', 'Accent'],
                  ['text', 'Text'], ['textSecondary', 'Text Secondary'],
                  ['headerBg', 'Header BG'], ['bg', 'Background'],
                ] as const).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-2">
                    <input type="color" value={(design.colors as any)[key] || '#000000'}
                      onChange={(e) => setDesignColors({ [key]: e.target.value })}
                      className="size-6 rounded border cursor-pointer" />
                    <span className="text-xs flex-1">{label}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{(design.colors as any)[key]}</span>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="content" className="space-y-2 mt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Watermark Text</Label>
                  <Input value={design.watermarkText} onChange={(e) => setDesign({ watermarkText: e.target.value })} placeholder="e.g. SAMPLE" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Background Type</Label>
                  <Select value={design.backgroundType} onValueChange={(v: any) => setDesign({ backgroundType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="solid">Solid</SelectItem>
                      <SelectItem value="gradient">Gradient</SelectItem>
                      <SelectItem value="image">Image</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>
            </Tabs>

            <Separator />

            <div className="flex gap-2">
              <Button size="sm" className="flex-1" onClick={handleSave} disabled={saving}>
                <Save className="size-3.5 mr-1" />{saving ? 'Saving...' : 'Save Design'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => { store.resetDesign(); }}>
                <RotateCcw className="size-3.5 mr-1" />Reset
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
