'use client';

import { useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Save, RotateCcw, Eye, Palette, Type, LayoutGrid, EyeOff, Search, Menu, X } from 'lucide-react';
import { useCertificateStore } from '@/store/certificate-store';
import {
  CERTIFICATE_TYPES,
  CERTIFICATE_TYPES_BY_STYLE,
  FONT_OPTIONS,
  FOIL_STYLES,
  DEFAULT_CERTIFICATE_DESIGN,
} from '@/lib/certificate-utils/types';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';

function ElementToggle({ label, prop, design, onToggle }: {
  label: string;
  prop: string;
  design: any;
  onToggle: (key: string) => void;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <Label className="text-sm cursor-pointer">{label}</Label>
      <Switch checked={design[prop]} onCheckedChange={() => onToggle(prop)} />
    </div>
  );
}

export function CertificateDesigner() {
  const { design, setDesign, setDesignColors, resetDesign, saveDesign, savedDesigns } = useCertificateStore();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSave = useCallback(() => {
    const name = prompt('Enter a name for this design:', design.name);
    if (!name) return;
    saveDesign(name);
    toast.success(`Design "${name}" saved`);
  }, [design.name, saveDesign]);

  const handleLoadDesign = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const found = savedDesigns.find(d => d.name === e.target.value);
    if (found) useCertificateStore.getState().loadDesign(found);
    setSidebarOpen(false);
  }, [savedDesigns]);

  const toggleProp = useCallback((key: string) => {
    setDesign({ [key]: !(design as any)[key] });
  }, [design, setDesign]);

  return (
    <div className="h-full flex flex-col bg-background relative">
      {isMobile && (
        <div className="flex items-center justify-between px-4 py-2 border-b bg-card sticky top-0 z-10">
          <h3 className="font-semibold text-sm">Certificate Designer</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
      )}

      {(true || !isMobile) && (
        <div className={`${isMobile ? 'absolute inset-0 z-20 bg-background transform transition-transform duration-300 ' + (sidebarOpen ? 'translate-x-0' : '-translate-x-full') : ''} w-80 border-r h-full flex flex-col bg-background`}>
          <div className="flex items-center justify-between px-4 py-2 border-b">
            <h3 className="font-semibold text-sm">Certificate Designer</h3>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={handleSave}>
                <Save className="h-3.5 w-3.5 mr-1" /> Save
              </Button>
              <Button variant="ghost" size="sm" onClick={resetDesign}>
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {savedDesigns.length > 0 && !isMobile && (
            <div className="px-4 py-2 border-b">
              <select
                className="w-full text-sm border rounded-md p-1.5 bg-background"
                onChange={handleLoadDesign}
                defaultValue=""
              >
                <option value="" disabled>Load saved design...</option>
                {savedDesigns.map(d => (
                  <option key={d.name} value={d.name}>{d.name}</option>
                ))}
              </select>
            </div>
          )}

          <Tabs defaultValue="content" className="flex-1 flex flex-col">
            <TabsList className={`${isMobile ? 'grid grid-cols-4 mx-2 mt-2' : 'grid grid-cols-2 mx-2 mt-2'} `}>
              <TabsTrigger value="content" title="Content"><Type className="h-4 w-4" /></TabsTrigger>
              <TabsTrigger value="design" title="Design"><Palette className="h-4 w-4" /></TabsTrigger>
              {isMobile && (
                <>
                  <TabsTrigger value="elements" title="Elements"><LayoutGrid className="h-4 w-4" /></TabsTrigger>
                  <TabsTrigger value="layout" title="Layout"><EyeOff className="h-4 w-4" /></TabsTrigger>
                </>
              )}
            </TabsList>

            <ScrollArea className="flex-1">
          <TabsContent value="content" className="p-4 space-y-3 m-0">
            <div className="space-y-2">
              <Label className="text-xs">Certificate Type</Label>
              <Select value={design.type} onValueChange={v => setDesign({ type: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CERTIFICATE_TYPES_BY_STYLE).map(([group, types]) => (
                    <div key={group}>
                      <div className="px-2 py-1 text-xs text-muted-foreground font-medium">{group}</div>
                      {types.map(t => (
                        <SelectItem key={t} value={t}>{CERTIFICATE_TYPES[t]}</SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-xs">Certificate Title</Label>
              <Input value={design.certificateTitle} onChange={e => setDesign({ certificateTitle: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Purpose Text</Label>
              <Input value={design.purposeText} onChange={e => setDesign({ purposeText: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Completion Text</Label>
              <Input value={design.completionText} onChange={e => setDesign({ completionText: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Honor Text</Label>
              <Input value={design.honorText} onChange={e => setDesign({ honorText: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Custom Message</Label>
              <textarea
                className="w-full min-h-[60px] text-sm border rounded-md p-2 bg-background resize-y"
                value={design.customMessage}
                onChange={e => setDesign({ customMessage: e.target.value })}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-xs">Left Signature Label</Label>
              <Input value={design.leftSignatureLabel} onChange={e => setDesign({ leftSignatureLabel: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Right Signature Label</Label>
              <Input value={design.rightSignatureLabel} onChange={e => setDesign({ rightSignatureLabel: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Watermark Text</Label>
              <Input value={design.watermarkText} onChange={e => setDesign({ watermarkText: e.target.value })} />
            </div>
          </TabsContent>

          <TabsContent value="design" className="p-4 space-y-3 m-0">
            <div className="space-y-2">
              <Label className="text-xs">Orientation</Label>
              <Select value={design.orientation} onValueChange={v => setDesign({ orientation: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="portrait">Portrait</SelectItem>
                  <SelectItem value="landscape">Landscape</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Foil Effect</Label>
              <div className="grid grid-cols-4 gap-1">
                {Object.entries(FOIL_STYLES).map(([key, foil]) => (
                  <Button
                    key={key}
                    variant={design.foilStyle === key ? 'default' : 'outline'}
                    size="sm"
                    className="text-[10px] h-8"
                    onClick={() => setDesign({ foilStyle: key as any })}
                  >
                    {foil.label}
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-xs">Font Family</Label>
              <Select value={design.fontFamily} onValueChange={v => setDesign({ fontFamily: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.map(f => (
                    <SelectItem key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Title Size</Label>
                <Select value={design.titleFontSize} onValueChange={v => setDesign({ titleFontSize: v as any })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['xl','2xl','3xl'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Heading</Label>
                <Select value={design.headingFontSize} onValueChange={v => setDesign({ headingFontSize: v as any })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['sm','md','lg','xl'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Body</Label>
                <Select value={design.bodyFontSize} onValueChange={v => setDesign({ bodyFontSize: v as any })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['sm','md','lg'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-xs">Border Style</Label>
              <Select value={design.borderStyle} onValueChange={v => setDesign({ borderStyle: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[
                    { value: 'solid', label: 'Solid Line' },
                    { value: 'double', label: 'Double Line' },
                    { value: 'dashed', label: 'Dashed' },
                    { value: 'ornate', label: 'Ornate' },
                    { value: 'filigree', label: 'Filigree' },
                    { value: 'laurel', label: 'Laurel Wreath' },
                    { value: 'artdeco', label: 'Art Deco' },
                    { value: 'vintage', label: 'Vintage' },
                    { value: 'none', label: 'None' },
                  ].map(b => (
                    <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Border Width</Label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(w => (
                  <Button
                    key={w}
                    variant={design.borderWidth === w ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1 h-8"
                    onClick={() => setDesign({ borderWidth: w })}
                  >
                    {w}
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-xs">Background</Label>
              <Select value={design.backgroundStyle} onValueChange={v => setDesign({ backgroundStyle: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="solid">Solid</SelectItem>
                  <SelectItem value="gradient">Gradient</SelectItem>
                </SelectContent>
              </Select>
              {design.backgroundStyle === 'gradient' && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <Label className="text-xs">From</Label>
                    <input
                      type="color"
                      value={design.gradientStart}
                      onChange={e => setDesign({ gradientStart: e.target.value })}
                      className="w-full h-8 rounded cursor-pointer"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">To</Label>
                    <input
                      type="color"
                      value={design.gradientEnd}
                      onChange={e => setDesign({ gradientEnd: e.target.value })}
                      className="w-full h-8 rounded cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Background Pattern</Label>
              <Select
                value={design.backgroundPattern}
                onValueChange={v => {
                  setDesign({ backgroundPattern: v as any, showBackgroundPattern: v !== 'none' });
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="damask">Damask</SelectItem>
                  <SelectItem value="shield">Academic Shield</SelectItem>
                  <SelectItem value="geometric">Geometric</SelectItem>
                  <SelectItem value="confetti">Confetti</SelectItem>
                  <SelectItem value="parchment">Parchment</SelectItem>
                  <SelectItem value="diagonal">Diagonal Lines</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-xs font-medium">Colors</Label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { key: 'primary', label: 'Primary' },
                  { key: 'secondary', label: 'Secondary' },
                  { key: 'accent', label: 'Accent' },
                  { key: 'text', label: 'Text' },
                  { key: 'textSecondary', label: 'Text Sec.' },
                  { key: 'headerBg', label: 'Header' },
                  { key: 'bg', label: 'Background' },
                  { key: 'border', label: 'Border' },
                ] as const).map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-2">
                    <input
                      type="color"
                      value={design.colors[key]}
                      onChange={e => setDesignColors({ [key]: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer border"
                    />
                    <span className="text-xs text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="elements" className="p-4 m-0">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground mb-2">Toggle elements on/off</p>
              <ElementToggle label="School Logo" prop="showSchoolLogo" design={design} onToggle={toggleProp} />
              <ElementToggle label="School Name" prop="showSchoolName" design={design} onToggle={toggleProp} />
              <ElementToggle label="Certificate Title" prop="showCertificateTitle" design={design} onToggle={toggleProp} />
              <ElementToggle label="Purpose Text" prop="showPurposeText" design={design} onToggle={toggleProp} />
              <ElementToggle label="Student Photo" prop="showStudentPhoto" design={design} onToggle={toggleProp} />
              <ElementToggle label="Student Name" prop="showStudentName" design={design} onToggle={toggleProp} />
              <ElementToggle label="Completion Text" prop="showCompletionText" design={design} onToggle={toggleProp} />
              <ElementToggle label="Honor Text" prop="showHonorText" design={design} onToggle={toggleProp} />
              <ElementToggle label="Student Details" prop="showStudentDetails" design={design} onToggle={toggleProp} />
              <ElementToggle label="Grade Badge" prop="showGrade" design={design} onToggle={toggleProp} />
              <ElementToggle label="Subjects Table" prop="showSubjects" design={design} onToggle={toggleProp} />
              <ElementToggle label="Attendance" prop="showAttendance" design={design} onToggle={toggleProp} />
              <ElementToggle label="Date" prop="showDate" design={design} onToggle={toggleProp} />
              <ElementToggle label="Custom Message" prop="showCustomMessage" design={design} onToggle={toggleProp} />
              <Separator className="my-1" />
              <ElementToggle label="Left Signature" prop="showLeftSignature" design={design} onToggle={toggleProp} />
              <ElementToggle label="Right Signature" prop="showRightSignature" design={design} onToggle={toggleProp} />
              <ElementToggle label="School Seal" prop="showSeal" design={design} onToggle={toggleProp} />
              <ElementToggle label="QR Code" prop="showQRCode" design={design} onToggle={toggleProp} />
              <Separator className="my-1" />
              <ElementToggle label="Border Art" prop="showBorderArt" design={design} onToggle={toggleProp} />
              <ElementToggle label="Background Pattern" prop="showBackgroundPattern" design={design} onToggle={toggleProp} />
              <ElementToggle label="Watermark" prop="showWatermark" design={design} onToggle={toggleProp} />
              <ElementToggle label="Footer" prop="showFooter" design={design} onToggle={toggleProp} />
              <ElementToggle label="Certificate Number" prop="showCertificateNumber" design={design} onToggle={toggleProp} />
              <ElementToggle label="Verification Code" prop="showVerificationCode" design={design} onToggle={toggleProp} />
            </div>
          </TabsContent>

          <TabsContent value="layout" className="p-4 space-y-3 m-0">
            <div className="space-y-2">
              <Label className="text-xs">Seal Position</Label>
              <Select value={design.sealPosition} onValueChange={v => setDesign({ sealPosition: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                  <SelectItem value="bottom">Bottom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-xs">Corner Style</Label>
              <Select value={design.cornerStyle} onValueChange={v => setDesign({ cornerStyle: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rounded">Rounded</SelectItem>
                  <SelectItem value="square">Square</SelectItem>
                  <SelectItem value="ornate">Ornate</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <p className="text-xs text-muted-foreground">
              Drag-and-drop element positioning will be available soon. Elements currently follow a smart layout algorithm.
            </p>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}
