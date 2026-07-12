'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import { useBannerTemplatesStore } from '@/store/banner-templates-store';
import {
  BANNER_SIZES, FONT_OPTIONS, COLOR_THEMES, SHAPES_BY_TYPE,
  type BannerSizePreset, type ShapeType,
} from '@/lib/banner-templates/types';
import { createShape } from '@/lib/banner-templates/types';
import { Plus, Trash2, RotateCcw, Palette, Type, Shapes, LayoutGrid } from 'lucide-react';

export function BannerDesigner() {
  const { design, setDesign, setDesignColors, resetDesign } = useBannerTemplatesStore();
  const [designTab, setDesignTab] = useState('content');

  const sizeCategories = [...new Set(BANNER_SIZES.map(s => s.category))];

  const addShape = (type: ShapeType) => {
    const newShape = createShape(type, design.colors.accent);
    setDesign({ shapes: [...design.shapes, newShape] });
  };

  const updateShape = (id: string, updates: Partial<typeof design.shapes[0]>) => {
    setDesign({
      shapes: design.shapes.map(s => s.id === id ? { ...s, ...updates } : s),
    });
  };

  const removeShape = (id: string) => {
    setDesign({ shapes: design.shapes.filter(s => s.id !== id) });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">Banner Size</Label>
      </div>
      <Select
        value={design.size}
        onValueChange={(v) => {
          const preset = BANNER_SIZES.find(s => s.key === v);
          if (preset) {
            setDesign({ size: v as BannerSizePreset, customWidth: preset.width, customHeight: preset.height });
          } else {
            setDesign({ size: v as BannerSizePreset });
          }
        }}
      >
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sizeCategories.map(cat => (
            <div key={cat}>
              <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase">{cat}</div>
              {BANNER_SIZES.filter(s => s.category === cat).map(s => (
                <SelectItem key={s.key} value={s.key} className="text-xs">
                  {s.label} ({s.width}×{s.height})
                </SelectItem>
              ))}
            </div>
          ))}
          <SelectItem value="custom" className="text-xs">Custom Size</SelectItem>
        </SelectContent>
      </Select>

      {design.size === 'custom' && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] text-muted-foreground">Width (px)</Label>
            <Input
              type="number"
              value={design.customWidth}
              onChange={e => setDesign({ customWidth: parseInt(e.target.value) || 1200 })}
              className="h-8 text-xs"
            />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Height (px)</Label>
            <Input
              type="number"
              value={design.customHeight}
              onChange={e => setDesign({ customHeight: parseInt(e.target.value) || 630 })}
              className="h-8 text-xs"
            />
          </div>
        </div>
      )}

      <Separator />

      <Tabs value={designTab} onValueChange={setDesignTab}>
        <TabsList className="w-full h-8">
          <TabsTrigger value="content" className="text-xs h-6 flex-1"><Type className="h-3 w-3 mr-1" />Content</TabsTrigger>
          <TabsTrigger value="design" className="text-xs h-6 flex-1"><Palette className="h-3 w-3 mr-1" />Design</TabsTrigger>
          <TabsTrigger value="shapes" className="text-xs h-6 flex-1"><Shapes className="h-3 w-3 mr-1" />Shapes</TabsTrigger>
          <TabsTrigger value="elements" className="text-xs h-6 flex-1"><LayoutGrid className="h-3 w-3 mr-1" />Elements</TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="space-y-3 mt-3">
          <div>
            <Label className="text-[10px] text-muted-foreground">School Name</Label>
            <Input value={design.schoolName} onChange={e => setDesign({ schoolName: e.target.value })} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Title</Label>
            <Input value={design.title} onChange={e => setDesign({ title: e.target.value })} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Subtitle</Label>
            <Input value={design.subtitle} onChange={e => setDesign({ subtitle: e.target.value })} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Description</Label>
            <Textarea value={design.description} onChange={e => setDesign({ description: e.target.value })} className="text-xs min-h-[60px] resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground">Event Date</Label>
              <Input value={design.eventDate} onChange={e => setDesign({ eventDate: e.target.value })} className="h-8 text-xs" placeholder="e.g. Jan 15, 2025" />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Event Time</Label>
              <Input value={design.eventTime} onChange={e => setDesign({ eventTime: e.target.value })} className="h-8 text-xs" placeholder="e.g. 10:00 AM" />
            </div>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Venue</Label>
            <Input value={design.venue} onChange={e => setDesign({ venue: e.target.value })} className="h-8 text-xs" placeholder="e.g. School Auditorium" />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Contact Info</Label>
            <Input value={design.contactInfo} onChange={e => setDesign({ contactInfo: e.target.value })} className="h-8 text-xs" placeholder="e.g. Call: +12345678" />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Custom Text</Label>
            <Textarea value={design.customText} onChange={e => setDesign({ customText: e.target.value })} className="text-xs min-h-[50px] resize-none" />
          </div>
        </TabsContent>

        <TabsContent value="design" className="space-y-3 mt-3">
          <div>
            <Label className="text-[10px] text-muted-foreground mb-1.5 block">Color Theme</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {COLOR_THEMES.map(theme => (
                <button
                  key={theme.name}
                  className="aspect-square rounded-md border-2 transition-all hover:scale-105"
                  style={{ background: `linear-gradient(135deg, ${theme.gradientStart}, ${theme.gradientEnd})` }}
                  title={theme.name}
                  onClick={() => setDesignColors({
                    primary: theme.primary, secondary: theme.secondary, accent: theme.accent,
                    bg: theme.bg, gradientStart: theme.gradientStart, gradientEnd: theme.gradientEnd,
                    text: theme.text, textSecondary: theme.textSecondary,
                  })}
                />
              ))}
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground">Primary</Label>
              <div className="flex gap-1">
                <input type="color" value={design.colors.primary} onChange={e => setDesignColors({ primary: e.target.value })} className="w-8 h-8 rounded cursor-pointer border-0" />
                <Input value={design.colors.primary} onChange={e => setDesignColors({ primary: e.target.value })} className="h-8 text-[10px] flex-1" />
              </div>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Accent</Label>
              <div className="flex gap-1">
                <input type="color" value={design.colors.accent} onChange={e => setDesignColors({ accent: e.target.value })} className="w-8 h-8 rounded cursor-pointer border-0" />
                <Input value={design.colors.accent} onChange={e => setDesignColors({ accent: e.target.value })} className="h-8 text-[10px] flex-1" />
              </div>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Text</Label>
              <div className="flex gap-1">
                <input type="color" value={design.colors.text} onChange={e => setDesignColors({ text: e.target.value })} className="w-8 h-8 rounded cursor-pointer border-0" />
                <Input value={design.colors.text} onChange={e => setDesignColors({ text: e.target.value })} className="h-8 text-[10px] flex-1" />
              </div>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Gradient Start</Label>
              <div className="flex gap-1">
                <input type="color" value={design.colors.gradientStart} onChange={e => setDesignColors({ gradientStart: e.target.value })} className="w-8 h-8 rounded cursor-pointer border-0" />
                <Input value={design.colors.gradientStart} onChange={e => setDesignColors({ gradientStart: e.target.value })} className="h-8 text-[10px] flex-1" />
              </div>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Gradient End</Label>
              <div className="flex gap-1">
                <input type="color" value={design.colors.gradientEnd} onChange={e => setDesignColors({ gradientEnd: e.target.value })} className="w-8 h-8 rounded cursor-pointer border-0" />
                <Input value={design.colors.gradientEnd} onChange={e => setDesignColors({ gradientEnd: e.target.value })} className="h-8 text-[10px] flex-1" />
              </div>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Background</Label>
              <div className="flex gap-1">
                <input type="color" value={design.colors.bg} onChange={e => setDesignColors({ bg: e.target.value })} className="w-8 h-8 rounded cursor-pointer border-0" />
                <Input value={design.colors.bg} onChange={e => setDesignColors({ bg: e.target.value })} className="h-8 text-[10px] flex-1" />
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <Label className="text-[10px] text-muted-foreground">Font</Label>
            <Select value={design.fontFamily} onValueChange={v => setDesign({ fontFamily: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FONT_OPTIONS.map(f => (
                  <SelectItem key={f.value} value={f.value} className="text-xs">{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-[10px] text-muted-foreground">Background Style</Label>
            <div className="grid grid-cols-4 gap-1 mt-1">
              {(['solid', 'gradient', 'pattern', 'image'] as const).map(style => (
                <Button
                  key={style}
                  variant={design.backgroundStyle === style ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-[10px]"
                  onClick={() => setDesign({ backgroundStyle: style })}
                >
                  {style}
                </Button>
              ))}
            </div>
          </div>

          {design.backgroundStyle === 'pattern' && (
            <div>
              <Label className="text-[10px] text-muted-foreground">Pattern</Label>
              <div className="grid grid-cols-3 gap-1 mt-1">
                {['damask', 'shield', 'geometric', 'confetti', 'parchment', 'diagonal'].map(p => (
                  <Button
                    key={p}
                    variant={design.backgroundPattern === p ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-[10px] capitalize"
                    onClick={() => setDesign({ backgroundPattern: p as any })}
                  >
                    {p}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {design.backgroundStyle === 'image' && (
            <div>
              <Label className="text-[10px] text-muted-foreground">Background Image URL</Label>
              <Input
                value={design.backgroundImage}
                onChange={e => setDesign({ backgroundImage: e.target.value })}
                className="h-8 text-xs"
                placeholder="Paste image URL or data URI"
              />
              <div className="mt-2">
                <Label className="text-[10px] text-muted-foreground">Overlay Opacity: {design.overlayOpacity}%</Label>
                <Slider
                  value={[design.overlayOpacity]}
                  onValueChange={([v]) => setDesign({ overlayOpacity: v })}
                  min={0} max={100} step={5}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          <Separator />

          <div>
            <Label className="text-[10px] text-muted-foreground">Border Style</Label>
            <Select value={design.borderStyle} onValueChange={v => setDesign({ borderStyle: v as any })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['none', 'solid', 'double', 'dashed', 'ornate', 'filigree', 'laurel', 'artdeco', 'vintage'].map(b => (
                  <SelectItem key={b} value={b} className="text-xs capitalize">{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {design.borderStyle !== 'none' && (
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-muted-foreground">Show Border</Label>
              <Switch checked={design.showBorder} onCheckedChange={v => setDesign({ showBorder: v })} />
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label className="text-[10px] text-muted-foreground">Text Align</Label>
            <div className="flex gap-1">
              {(['left', 'center', 'right'] as const).map(a => (
                <Button
                  key={a}
                  variant={design.textAlign === a ? 'default' : 'outline'}
                  size="sm"
                  className="h-6 px-2 text-[10px] capitalize"
                  onClick={() => setDesign({ textAlign: a })}
                >
                  {a}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-[10px] text-muted-foreground">Content Position</Label>
            <div className="grid grid-cols-3 gap-1 mt-1">
              {(['top', 'center', 'bottom'] as const).map(p => (
                <Button
                  key={p}
                  variant={design.contentPosition === p ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-[10px] capitalize"
                  onClick={() => setDesign({ contentPosition: p })}
                >
                  {p}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-[10px] text-muted-foreground">Title Size: {Math.round(design.titleFontSize * 100)}%</Label>
            <Slider
              value={[design.titleFontSize * 100]}
              onValueChange={([v]) => setDesign({ titleFontSize: v / 100 })}
              min={30} max={200} step={10}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Subtitle Size: {Math.round(design.subtitleFontSize * 100)}%</Label>
            <Slider
              value={[design.subtitleFontSize * 100]}
              onValueChange={([v]) => setDesign({ subtitleFontSize: v / 100 })}
              min={20} max={150} step={10}
              className="mt-1"
            />
          </div>

          <Separator />

          <div>
            <Label className="text-[10px] text-muted-foreground">School Logo URL</Label>
            <Input
              value={design.logoUrl}
              onChange={e => setDesign({ logoUrl: e.target.value })}
              className="h-8 text-xs"
              placeholder="Paste logo image URL"
            />
            <div className="flex items-center justify-between mt-2">
              <Label className="text-[10px] text-muted-foreground">Show Logo</Label>
              <Switch checked={design.showLogo} onCheckedChange={v => setDesign({ showLogo: v })} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="shapes" className="space-y-3 mt-3">
          <div>
            <Label className="text-[10px] text-muted-foreground mb-2 block">Add Shape</Label>
            <div className="grid grid-cols-3 gap-1">
              {(Object.keys(SHAPES_BY_TYPE) as ShapeType[]).map(type => (
                <Button
                  key={type}
                  variant="outline"
                  size="sm"
                  className="h-7 text-[10px]"
                  onClick={() => addShape(type)}
                >
                  <span className="mr-1">{SHAPES_BY_TYPE[type].icon}</span>
                  {SHAPES_BY_TYPE[type].label}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            {design.shapes.map(shape => (
              <Card key={shape.id} className="p-2">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={shape.enabled}
                    onCheckedChange={v => updateShape(shape.id, { enabled: v })}
                  />
                  <span className="text-xs font-medium flex-1">
                    {SHAPES_BY_TYPE[shape.type]?.icon} {SHAPES_BY_TYPE[shape.type]?.label}
                  </span>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeShape(shape.id)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
                {shape.enabled && (
                  <div className="mt-2 space-y-2 pl-8">
                    <div className="flex items-center gap-2">
                      <Label className="text-[10px] text-muted-foreground w-12">Color</Label>
                      <input type="color" value={shape.color} onChange={e => updateShape(shape.id, { color: e.target.value })} className="w-6 h-6 rounded cursor-pointer border-0" />
                      <Input value={shape.color} onChange={e => updateShape(shape.id, { color: e.target.value })} className="h-6 text-[10px] flex-1" />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Opacity: {shape.opacity}%</Label>
                      <Slider
                        value={[shape.opacity]}
                        onValueChange={([v]) => updateShape(shape.id, { opacity: v })}
                        min={10} max={100} step={5}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Size: {Math.round(shape.size * 100)}%</Label>
                      <Slider
                        value={[shape.size * 100]}
                        onValueChange={([v]) => updateShape(shape.id, { size: v / 100 })}
                        min={5} max={100} step={5}
                        className="mt-1"
                      />
                    </div>
                  </div>
                )}
              </Card>
            ))}
            {design.shapes.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No shapes added yet. Click a shape above to add it.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="elements" className="space-y-3 mt-3">
          {[
            { key: 'showSchoolName', label: 'School Name' },
            { key: 'showTitle', label: 'Title' },
            { key: 'showSubtitle', label: 'Subtitle' },
            { key: 'showDescription', label: 'Description' },
            { key: 'showDate', label: 'Event Date' },
            { key: 'showTime', label: 'Event Time' },
            { key: 'showVenue', label: 'Venue' },
            { key: 'showContact', label: 'Contact Info' },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between">
              <Label className="text-xs">{item.label}</Label>
              <Switch
                checked={(design as any)[item.key]}
                onCheckedChange={v => setDesign({ [item.key]: v } as any)}
              />
            </div>
          ))}
        </TabsContent>
      </Tabs>

      <Separator />

      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 h-8" onClick={resetDesign}>
          <RotateCcw className="h-3 w-3 mr-1" /> Reset
        </Button>
      </div>
    </div>
  );
}
