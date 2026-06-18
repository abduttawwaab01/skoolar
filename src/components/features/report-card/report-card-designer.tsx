'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Save, RotateCcw, Eye, Table, ChartBarStacked, CircleUser, School as SchoolIcon, Palette, Type, Layout, FileText, User, BarChart3, TrendingUp, Activity, Eye as EyeIcon, Camera, MapPin, Phone, Mail, FileImage, Image, PenTool, Grid, Columns, Rows, Box } from 'lucide-react';
import { useReportCardStore } from '@/store/report-card-store';
import { ReportCardPreview } from './report-card-preview';

export function ReportCardDesigner() {
  const store = useReportCardStore();
  const { design, setDesign } = store;
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('visibility');

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

  const renderColorPicker = (key: string, label: string) => {
    return (
      <div key={key} className="space-y-1.5">
        <Label className="text-[9px] text-muted-foreground">{label}</Label>
        <div className="relative group">
          <input 
            type="color" 
            value={(design.colors as any)[key] || '#000000'}
            onChange={(e) => store.setDesignColors({ [key]: e.target.value })}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
          />
          <div 
            className="size-6 rounded border-2 border-gray-200 group-hover:border-gray-400 transition-colors cursor-pointer"
            style={{ backgroundColor: (design.colors as any)[key] || '#000000' }}
          />
        </div>
      </div>
    );
  };

  const renderVisibilitySection = () => (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium flex items-center gap-1.5 mb-2"><EyeIcon className="size-3" />Academic Sections</p>
        <div className="grid grid-cols-1 gap-2 pl-1">
          <div className="flex items-center justify-between p-2 rounded-md bg-gray-50 hover:bg-gray-100 transition-colors">
            <span className="text-xs flex items-center gap-2"><SchoolIcon className="size-3.5 text-muted-foreground" />School Header</span>
            <Switch checked={design.showHeader} onCheckedChange={(v) => setDesign({ showHeader: v })} />
          </div>
          <div className="flex items-center justify-between p-2 rounded-md bg-gray-50 hover:bg-gray-100 transition-colors">
            <span className="text-xs flex items-center gap-2"><CircleUser className="size-3.5 text-muted-foreground" />Student Info</span>
            <Switch checked={design.showStudentInfo} onCheckedChange={(v) => setDesign({ showStudentInfo: v })} />
          </div>
          <div className="flex items-center justify-between p-2 rounded-md bg-gray-50 hover:bg-gray-100 transition-colors">
            <span className="text-xs flex items-center gap-2"><Table className="size-3.5 text-muted-foreground" />Subject Results</span>
            <Switch checked={design.showSubjectsTable} onCheckedChange={(v) => setDesign({ showSubjectsTable: v })} />
          </div>
          <div className="flex items-center justify-between p-2 rounded-md bg-gray-50 hover:bg-gray-100 transition-colors">
            <span className="text-xs flex items-center gap-2"><ChartBarStacked className="size-3.5 text-muted-foreground" />Performance Chart</span>
            <Switch checked={design.showChart} onCheckedChange={(v) => setDesign({ showChart: v })} />
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium flex items-center gap-1.5 mb-2"><FileText className="size-3" />Assessment Sections</p>
        <div className="grid grid-cols-1 gap-2 pl-1">
          <div className="flex items-center justify-between p-2 rounded-md bg-gray-50 hover:bg-gray-100 transition-colors">
            <span className="text-xs">Domain Assessment</span>
            <Switch checked={design.showDomains} onCheckedChange={(v) => setDesign({ showDomains: v })} />
          </div>
          <div className="flex items-center justify-between p-2 rounded-md bg-gray-50 hover:bg-gray-100 transition-colors">
            <span className="text-xs">Cumulative Average</span>
            <Switch checked={design.showCumulative} onCheckedChange={(v) => setDesign({ showCumulative: v })} />
          </div>
          <div className="flex items-center justify-between p-2 rounded-md bg-gray-50 hover:bg-gray-100 transition-colors">
            <span className="text-xs">Attendance</span>
            <Switch checked={design.showAttendance} onCheckedChange={(v) => setDesign({ showAttendance: v })} />
          </div>
          <div className="flex items-center justify-between p-2 rounded-md bg-gray-50 hover:bg-gray-100 transition-colors">
            <span className="text-xs">Attendance Correlation</span>
            <Switch checked={design.showCorrelation} onCheckedChange={(v) => setDesign({ showCorrelation: v })} />
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium flex items-center gap-1.5 mb-2"><PenTool className="size-3" />Comments & Footer</p>
        <div className="grid grid-cols-1 gap-2 pl-1">
          <div className="flex items-center justify-between p-2 rounded-md bg-gray-50 hover:bg-gray-100 transition-colors">
            <span className="text-xs">Remarks & Signatures</span>
            <Switch checked={design.showRemarks} onCheckedChange={(v) => setDesign({ showRemarks: v })} />
          </div>
          <div className="flex items-center justify-between p-2 rounded-md bg-gray-50 hover:bg-gray-100 transition-colors">
            <span className="text-xs">Watermark</span>
            <Switch checked={design.showWatermark} onCheckedChange={(v) => setDesign({ showWatermark: v })} />
          </div>
          {design.showWatermark && (
            <div className="pl-2 mt-1">
              <Input value={design.watermarkText} onChange={(e) => setDesign({ watermarkText: e.target.value })} placeholder="Watermark text" className="h-7 text-xs" />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderColorsSection = () => (
    <div>
      <p className="text-xs font-medium mb-3 flex items-center gap-1.5"><Palette className="size-3" />Color Scheme</p>
      <div className="grid grid-cols-3 gap-3">
        {renderColorPicker('primary', 'Primary')}
        {renderColorPicker('secondary', 'Secondary')}
        {renderColorPicker('accent', 'Accent')}
        {renderColorPicker('text', 'Text')}
        {renderColorPicker('textSecondary', 'Muted')}
        {renderColorPicker('headerBg', 'Header')}
      </div>
    </div>
  );

  const renderLayoutSection = () => (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium mb-2 flex items-center gap-1.5"><Layout className="size-3" />Layout Options</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 rounded-md bg-gray-50">
            <Label className="text-[9px] text-muted-foreground block mb-1">Orientation</Label>
            <select 
              value={design.orientation} 
              onChange={(e) => setDesign({ orientation: e.target.value as 'portrait' | 'landscape' })} 
              className="w-full h-7 text-xs border rounded px-2"
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </div>
          <div className="p-2 rounded-md bg-gray-50">
            <Label className="text-[9px] text-muted-foreground block mb-1">Font Size</Label>
            <select 
              value={design.fontSize} 
              onChange={(e) => setDesign({ fontSize: e.target.value as 'sm' | 'md' | 'lg' })} 
              className="w-full h-7 text-xs border rounded px-2"
            >
              <option value="sm">Small</option>
              <option value="md">Medium</option>
              <option value="lg">Large</option>
            </select>
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium mb-2 flex items-center gap-1.5"><Type className="size-3" />Typography</p>
        <div className="space-y-2">
          <div className="p-2 rounded-md bg-gray-50">
            <Label className="text-[9px] text-muted-foreground block mb-1">Font Family</Label>
            <select 
              value={design.fontFamily} 
              onChange={(e) => setDesign({ fontFamily: e.target.value })} 
              className="w-full h-7 text-xs border rounded px-2"
            >
              <option value="Inter">Inter</option>
              <option value="Arial">Arial</option>
              <option value="Times New Roman">Times New Roman</option>
              <option value="Georgia">Georgia</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-1 space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Palette className="size-4" />Report Card Designer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">

            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant={activeTab === 'visibility' ? 'default' : 'outline'} 
                className="flex-1 h-7 text-xs" 
                onClick={() => setActiveTab('visibility')
              >
                <EyeIcon className="size-3 mr-1" />Visibility
              </Button>
              <Button 
                size="sm" 
                variant={activeTab === 'colors' ? 'default' : 'outline'} 
                className="flex-1 h-7 text-xs" 
                onClick={() => setActiveTab('colors')
              >
                <Palette className="size-3 mr-1" />Colors
              </Button>
              <Button 
                size="sm" 
                variant={activeTab === 'layout' ? 'default' : 'outline'} 
                className="flex-1 h-7 text-xs" 
                onClick={() => setActiveTab('layout')
              >
                <Layout className="size-3 mr-1" />Layout
              </Button>
            </div>

            {activeTab === 'visibility' && renderVisibilitySection()}
            {activeTab === 'colors' && renderColorsSection()}
            {activeTab === 'layout' && renderLayoutSection()}

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
