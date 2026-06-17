'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { Palette, Type, Layout, Image, Save, RotateCcw, ChevronDown, ChevronRight, School, User, BookOpen, BarChart3, MessageSquare, FileImage, Sparkles } from 'lucide-react';
import { useReportCardStore } from '@/store/report-card-store';
import { useAppStore } from '@/store/app-store';
import { DEFAULT_TEMPLATES } from '@/lib/report-card-utils/default-templates';
import { ReportCardPreview } from './report-card-preview';
import { cn } from '@/lib/utils';

const SECTION_GROUPS = [
  {
    id: 'header',
    label: 'School Header',
    icon: School,
    keys: ['showHeader', 'showLogo', 'showMotto', 'showAddress', 'showContacts'] as const,
  },
  {
    id: 'student',
    label: 'Student Information',
    icon: User,
    keys: ['showStudentInfo', 'showStudentPhoto'] as const,
  },
  {
    id: 'academics',
    label: 'Academics',
    icon: BookOpen,
    keys: ['showSubjectsTable', 'showDomains', 'showChart'] as const,
  },
  {
    id: 'insights',
    label: 'Insights',
    icon: BarChart3,
    keys: ['showCumulative', 'showAttendance', 'showCorrelation'] as const,
  },
  {
    id: 'closing',
    label: 'Closing Sections',
    icon: MessageSquare,
    keys: ['showRemarks', 'showSignatures', 'showFooter', 'showWatermark'] as const,
  },
] as const;

const SECTION_LABELS: Record<string, string> = {
  showHeader: 'Header',
  showLogo: 'Logo',
  showMotto: 'Motto',
  showAddress: 'Address',
  showContacts: 'Contacts',
  showStudentInfo: 'Student Info',
  showStudentPhoto: 'Student Photo',
  showSubjectsTable: 'Subjects Table',
  showDomains: 'Domains',
  showChart: 'Chart',
  showCumulative: 'Cumulative Avg',
  showAttendance: 'Attendance',
  showCorrelation: 'Attend. Correlation',
  showRemarks: 'Remarks',
  showSignatures: 'Signatures',
  showFooter: 'Footer',
  showWatermark: 'Watermark',
};

export function ReportCardDesigner() {
  const store = useReportCardStore();
  const { currentUser } = useAppStore();
  const { design, setDesign, setDesignColors, applyPreset, setSelectedPresetId, selectedPresetId } = store;
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    header: true, student: true, academics: true, insights: false, closing: false,
  });
  const [saving, setSaving] = useState(false);

  const toggleGroup = (id: string) => setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }));

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

  const applyPresetHandler = useCallback((presetId: string) => {
    const preset = DEFAULT_TEMPLATES.find(p => p.id === presetId);
    if (preset) { applyPreset(preset); setSelectedPresetId(presetId); }
  }, [applyPreset, setSelectedPresetId]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-1 space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Design Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Preset</Label>
              <Select value={selectedPresetId} onValueChange={applyPresetHandler}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select preset..." /></SelectTrigger>
                <SelectContent>
                  {DEFAULT_TEMPLATES.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px]">Name</Label>
                <Input value={design.name} onChange={(e) => setDesign({ name: e.target.value })} placeholder="My Design" className="h-7 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Orientation</Label>
                <Select value={design.orientation} onValueChange={(v: any) => setDesign({ orientation: v })}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="portrait" className="text-xs">Portrait</SelectItem>
                    <SelectItem value="landscape" className="text-xs">Landscape</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="space-y-1">
              <Label className="text-[10px] font-medium">Section Visibility</Label>
              {SECTION_GROUPS.map((group) => (
                <Collapsible key={group.id} open={openGroups[group.id]} onOpenChange={() => toggleGroup(group.id)}>
                  <CollapsibleTrigger className="flex w-full items-center justify-between py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground">
                    <span className="flex items-center gap-1.5">
                      <group.icon className="size-3" />
                      {group.label}
                    </span>
                    {openGroups[group.id] ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-1 pl-4">
                    {group.keys.map((key) => (
                      <div key={key} className="flex items-center justify-between py-0.5">
                        <span className="text-[10px]">{SECTION_LABELS[key]}</span>
                        <Switch checked={design[key] as boolean} onCheckedChange={(v) => setDesign({ [key]: v } as any)} className="scale-75" />
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>

            <Separator />

            <Collapsible defaultOpen={false}>
              <CollapsibleTrigger className="flex w-full items-center justify-between py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground">
                <span className="flex items-center gap-1.5"><Palette className="size-3" />Colors & Typography</span>
                <ChevronDown className="size-3" />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 pt-2">
                <div className="grid grid-cols-4 gap-1.5">
                  {([
                    ['primary', 'Primary'], ['secondary', 'Secondary'], ['accent', 'Accent'],
                    ['text', 'Text'], ['textSecondary', 'Muted'], ['headerBg', 'Header'],
                    ['bg', 'Bg'],
                  ] as const).map(([key, label]) => (
                    <div key={key} className="space-y-0.5">
                      <Label className="text-[8px] text-muted-foreground">{label}</Label>
                      <div className="flex items-center gap-1">
                        <input type="color" value={(design.colors as any)[key] || '#000000'}
                          onChange={(e) => setDesignColors({ [key]: e.target.value })}
                          className="size-5 rounded border cursor-pointer p-0" />
                        <span className="text-[7px] text-muted-foreground font-mono truncate">{(design.colors as any)[key]}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="space-y-1">
                    <Label className="text-[10px]">Font</Label>
                    <Select value={design.fontFamily} onValueChange={(v) => setDesign({ fontFamily: v })}>
                      <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Inter" className="text-xs">Inter</SelectItem>
                        <SelectItem value="Arial" className="text-xs">Arial</SelectItem>
                        <SelectItem value="Georgia" className="text-xs">Georgia</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Size</Label>
                    <Select value={design.fontSize} onValueChange={(v: any) => setDesign({ fontSize: v })}>
                      <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sm" className="text-xs">Small</SelectItem>
                        <SelectItem value="md" className="text-xs">Medium</SelectItem>
                        <SelectItem value="lg" className="text-xs">Large</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Background</Label>
                  <Select value={design.backgroundType} onValueChange={(v: any) => setDesign({ backgroundType: v })}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="solid" className="text-xs">Solid</SelectItem>
                      <SelectItem value="gradient" className="text-xs">Gradient</SelectItem>
                      <SelectItem value="image" className="text-xs">Image</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Collapsible defaultOpen={false}>
              <CollapsibleTrigger className="flex w-full items-center justify-between py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground">
                <span className="flex items-center gap-1.5"><FileImage className="size-3" />Watermark</span>
                <ChevronDown className="size-3" />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px]">Show Watermark</span>
                  <Switch checked={design.showWatermark} onCheckedChange={(v) => setDesign({ showWatermark: v })} className="scale-75" />
                </div>
                {design.showWatermark && (
                  <Input value={design.watermarkText} onChange={(e) => setDesign({ watermarkText: e.target.value })} placeholder="e.g. SAMPLE" className="h-7 text-xs" />
                )}
              </CollapsibleContent>
            </Collapsible>

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
