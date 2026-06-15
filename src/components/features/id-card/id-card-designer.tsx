'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app-store';
import { useIDCardStore } from '@/store/id-card-store';
import { DEFAULT_TEMPLATES } from '@/lib/id-card-utils/default-templates';
import { BLOOD_GROUPS, FONT_SIZES, CARD_DIMENSIONS } from '@/lib/id-card-utils/constants';
import { IDCardPreview } from './id-card-preview';
import { toast } from 'sonner';
import {
  User, Palette, RotateCcw, Check, Loader2, Eye, EyeOff,
  ChevronRight, Maximize2, Minimize2, Camera, Building2,
  QrCode, Hash, Image as ImageIcon, FileImage, Download, Printer,
  GraduationCap, Briefcase, Chalkboard, Crown, Save,
  Sparkles, Type, CreditCard, X, Plus, RefreshCw,
} from 'lucide-react';

export function IDCardDesigner() {
  const { currentUser } = useAppStore();
  const store = useIDCardStore();
  const {
    personType, setPersonType,
    selectedPersonId, setSelectedPersonId,
    personData, setPersonData,
    photoFile, setPhotoFile,
    logoFile, setLogoFile,
    signatureFile, setSignatureFile,
    cardSide, setCardSide,
    design, setDesign,
    selectedDesignId, setSelectedDesignId,
    previewSrc, setPreviewSrc,
    previewLoading, setPreviewLoading,
  } = store;

  const [fullscreen, setFullscreen] = useState(false);
  const [people, setPeople] = useState<any[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [saving, setSaving] = useState(false);
  const [templateName, setTemplateName] = useState(design.name);
  const [activeColorTab, setActiveColorTab] = useState('presets');
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch people when type changes
  useEffect(() => {
    async function load() {
      setLoadingPeople(true);
      try {
        const res = await fetch(`/api/id-cards?type=${personType}&limit=200`);
        if (res.ok) {
          const json = await res.json();
          setPeople(json.data || []);
        }
      } catch { /* ignore */ }
      finally { setLoadingPeople(false); }
    }
    load();
  }, [personType]);

  const getSchoolOverride = useCallback(async () => {
    if (!currentUser.schoolId) return null;
    try {
      const res = await fetch(`/api/schools/${currentUser.schoolId}`);
      if (res.ok) return await res.json();
    } catch { /* ignore */ }
    return null;
  }, [currentUser.schoolId]);

  const refreshPreview = useCallback(async () => {
    const name = personData.fullName?.trim() || 'John Doe';
    const p = design.colors;
    setPreviewLoading(true);
    try {
      const body: Record<string, unknown> = {
        type: personType,
        name,
        displayId: personData.displayId || 'STU-001',
        className: personData.className || 'Grade 5',
        section: personData.section || '',
        department: personData.department || '',
        gender: personData.gender || '',
        phone: personData.phone || '',
        email: personData.email || '',
        address: personData.address || '',
        bloodGroup: personData.bloodGroup || '',
        dateOfBirth: personData.dateOfBirth || '',
        house: personData.house || '',
        academicSession: personData.academicSession || '',
        designation: personData.designation || '',
        position: personData.position || '',
        role: personData.role || (personType === 'student' ? 'STUDENT' : personType === 'teacher' ? 'TEACHER' : 'STAFF'),
        colors: p,
        showPhoto: design.showPhoto,
        showLogo: design.showLogo,
        showQR: design.showQRCode,
        showBarcode: design.showBarcode,
        showSignature: design.showSignature,
        showWatermark: design.showWatermark,
        showMotto: design.showMotto,
        showExpiryDate: design.showExpiryDate,
        showIssueDate: design.showIssueDate,
        orientation: design.orientation,
        isBack: cardSide === 'back',
        backText: design.backText || '',
        issueDate: design.showIssueDate ? new Date().toISOString().split('T')[0] : null,
        expiryDate: design.showExpiryDate ? new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0] : null,
        watermarkText: design.showWatermark ? (design.watermarkText || currentUser.schoolName || '') : null,
        qrColor: p.primary,
      };
      if (photoFile) body.photoDataUrl = photoFile;
      if (signatureFile) body.signatureUrl = signatureFile;
      if (logoFile || currentUser.schoolName) {
        const school = await getSchoolOverride();
        body.schoolOverride = {
          name: currentUser.schoolName || school?.name || 'School Name',
          logo: logoFile || school?.logo || null,
          motto: school?.motto || '',
          id: currentUser.schoolId,
        };
      }

      const res = await fetch('/api/id-cards/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) return;
      const json = await res.json();
      if (json.data) setPreviewSrc(`data:image/png;base64,${json.data}`);
    } catch { /* fallback */ }
    finally { setPreviewLoading(false); }
  }, [personType, personData, design, cardSide, photoFile, signatureFile, logoFile, currentUser, getSchoolOverride]);

  useEffect(() => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(refreshPreview, 500);
    return () => { if (previewTimerRef.current) clearTimeout(previewTimerRef.current); };
  }, [refreshPreview]);

  const handleSelectPerson = (id: string) => {
    setSelectedPersonId(id);
    if (!id) return;
    const person = people.find((p) => p.id === id || p.userId === id);
    if (!person) return;

    const name = person.name || person.user?.name || '';
    setPersonData({
      fullName: name,
      displayId: person.admissionNo || person.employeeNo || person.displayId || '',
      role: personType === 'student' ? 'STUDENT' : person.role || '',
      department: person.class?.name || person.department || person.specialization || '',
      className: person.class?.name || '',
      section: person.class?.section || '',
      gender: person.gender || '',
      bloodGroup: person.bloodGroup || 'O+',
      phone: person.phone || '',
      email: person.email || person.user?.email || '',
      address: person.address || '',
      dateOfBirth: person.dateOfBirth || '',
    });
    setPhotoFile(person.photo || person.user?.avatar || null);
  };

  const handleSaveDesign = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/id-card-designs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          id: selectedDesignId || undefined,
          name: templateName,
          orientation: design.orientation,
          primaryColor: design.colors.primary,
          secondaryColor: design.colors.secondary,
          accentColor: design.colors.accent,
          textColor: design.colors.text,
          textSecondaryColor: design.colors.textSecondary,
          headerBgColor: design.colors.headerBg,
          bgColor: design.colors.bg,
          gradientFrom: design.colors.gradientFrom,
          gradientTo: design.colors.gradientTo,
          backgroundType: design.backgroundType,
          fontFamily: design.fontFamily,
          fontSize: design.fontSize,
          showPhoto: design.showPhoto,
          showLogo: design.showLogo,
          showQRCode: design.showQRCode,
          showBarcode: design.showBarcode,
          showSignature: design.showSignature,
          showWatermark: design.showWatermark,
          showMotto: design.showMotto,
          showExpiryDate: design.showExpiryDate,
          showIssueDate: design.showIssueDate,
          qrPosition: design.qrPosition,
          backLayoutType: design.backLayoutType,
          showEmergencyInfo: design.showEmergencyInfo,
          showMedicalInfo: design.showMedicalInfo,
          showTerms: design.showTerms,
          showSignatory: design.showSignatory,
          showSchoolInfo: design.showSchoolInfo,
          backText: design.backText,
          termsText: design.termsText,
          signatureLabel: design.signatureLabel,
          watermarkText: design.watermarkText,
        }),
      });
      if (res.ok) {
        toast.success('Design saved successfully');
      } else {
        toast.error('Failed to save design');
      }
    } catch {
      toast.error('Error saving design');
    } finally {
      setSaving(false);
    }
  };

  const colorPresets = [
    { name: 'Emerald', colors: { primary: '#059669', secondary: '#FFFFFF', accent: '#fbbf24', text: '#064e3b', textSecondary: '#6b7280', headerBg: '#059669', bg: '#ffffff' } },
    { name: 'Royal Blue', colors: { primary: '#1d4ed8', secondary: '#FFFFFF', accent: '#f59e0b', text: '#1e3a5f', textSecondary: '#6b7280', headerBg: '#1d4ed8', bg: '#ffffff' } },
    { name: 'Crimson', colors: { primary: '#dc2626', secondary: '#FFFFFF', accent: '#fcd34d', text: '#7f1d1d', textSecondary: '#6b7280', headerBg: '#dc2626', bg: '#ffffff' } },
    { name: 'Purple', colors: { primary: '#7c3aed', secondary: '#faf5ff', accent: '#34d399', text: '#4c1d95', textSecondary: '#7c3aed', headerBg: '#7c3aed', bg: '#ffffff' } },
    { name: 'Teal', colors: { primary: '#0d9488', secondary: '#FFFFFF', accent: '#fbbf24', text: '#134e4a', textSecondary: '#6b7280', headerBg: '#0d9488', bg: '#ffffff' } },
    { name: 'Amber', colors: { primary: '#d97706', secondary: '#fffbeb', accent: '#3b82f6', text: '#78350f', textSecondary: '#d97706', headerBg: '#d97706', bg: '#ffffff' } },
    { name: 'Rose', colors: { primary: '#e11d48', secondary: '#fff1f2', accent: '#a78bfa', text: '#881337', textSecondary: '#e11d48', headerBg: '#e11d48', bg: '#ffffff' } },
    { name: 'Slate', colors: { primary: '#334155', secondary: '#FFFFFF', accent: '#0ea5e9', text: '#0f172a', textSecondary: '#64748b', headerBg: '#334155', bg: '#ffffff' } },
  ];

  const inputCls = 'h-7 text-xs';

  return (
    <div className={cn('grid gap-4', fullscreen ? 'grid-cols-[340px_1fr]' : 'grid-cols-1 xl:grid-cols-[360px_1fr]')}>
      {/* LEFT: Controls */}
      <div className="space-y-3 max-h-[calc(100vh-160px)] overflow-y-auto pr-1 scrollbar-thin">
        <div className="flex items-center gap-2 mb-2">
          <Button variant="outline" size="sm" onClick={() => setFullscreen(!fullscreen)} className="h-7 text-xs">
            {fullscreen ? <Minimize2 className="size-3 mr-1" /> : <Maximize2 className="size-3 mr-1" />}
            {fullscreen ? 'Compact' : 'Fullscreen'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => store.resetDesign()} className="h-7 text-xs">
            <RotateCcw className="size-3 mr-1" /> Reset
          </Button>
        </div>

        <Tabs defaultValue="info" className="w-full">
          <TabsList className="w-full grid grid-cols-4 h-8">
            <TabsTrigger value="info" className="text-[10px]"><User className="size-3 mr-1" />Info</TabsTrigger>
            <TabsTrigger value="design" className="text-[10px]"><Palette className="size-3 mr-1" />Design</TabsTrigger>
            <TabsTrigger value="back" className="text-[10px]"><QrCode className="size-3 mr-1" />Back</TabsTrigger>
            <TabsTrigger value="export" className="text-[10px]"><Download className="size-3 mr-1" />Export</TabsTrigger>
          </TabsList>

          {/* Info Tab */}
          <TabsContent value="info" className="space-y-2.5 mt-2">
            <Card className="border shadow-none">
              <CardContent className="p-3 space-y-2.5">
                <div className="grid grid-cols-2 gap-1.5">
                  {([{ value: 'student', label: 'Student', icon: GraduationCap },
                    { value: 'teacher', label: 'Teacher', icon: Chalkboard },
                    { value: 'staff', label: 'Staff', icon: Briefcase },
                    { value: 'executive', label: 'Executive', icon: Crown },
                  ] as const).map((t) => (
                    <Button
                      key={t.value}
                      type="button"
                      variant={personType === t.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPersonType(t.value)}
                      className="h-7 text-[10px]"
                    >
                      <t.icon className="size-3 mr-1" />
                      {t.label}
                    </Button>
                  ))}
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] font-medium">Select from Database</Label>
                  <select
                    value={selectedPersonId}
                    onChange={(e) => handleSelectPerson(e.target.value)}
                    disabled={loadingPeople}
                    className="flex h-7 w-full rounded-md border border-input bg-background px-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">-- Manual Entry --</option>
                    {people.map((p) => (
                      <option key={p.id || p.userId} value={p.id || p.userId}>
                        {personType === 'student'
                          ? `${p.user?.name || 'Unknown'} (${p.admissionNo || 'N/A'})`
                          : `${p.name || 'Unknown'} (${p.employeeNo || p.displayId || 'N/A'})`}
                      </option>
                    ))}
                  </select>
                  {loadingPeople && <span className="text-[9px] text-muted-foreground">Loading...</span>}
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1"><Label className="text-[10px]">Full Name</Label><Input value={personData.fullName} onChange={(e) => setPersonData({ fullName: e.target.value })} className={inputCls} /></div>
                  <div className="space-y-1"><Label className="text-[10px]">ID Number</Label><Input value={personData.displayId} onChange={(e) => setPersonData({ displayId: e.target.value })} className={inputCls} /></div>
                  <div className="space-y-1"><Label className="text-[10px]">Role/Title</Label><Input value={personData.role} onChange={(e) => setPersonData({ role: e.target.value })} className={inputCls} /></div>
                  <div className="space-y-1"><Label className="text-[10px]">Class/Dept</Label><Input value={personData.className || personData.department} onChange={(e) => setPersonData({ className: e.target.value, department: e.target.value })} className={inputCls} /></div>
                  <div className="space-y-1"><Label className="text-[10px]">Blood Group</Label>
                    <select value={personData.bloodGroup} onChange={(e) => setPersonData({ bloodGroup: e.target.value })}
                      className="flex h-7 w-full rounded-md border border-input bg-background px-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                      {BLOOD_GROUPS.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1"><Label className="text-[10px]">Gender</Label><Input value={personData.gender} onChange={(e) => setPersonData({ gender: e.target.value })} className={inputCls} /></div>
                  <div className="space-y-1"><Label className="text-[10px]">Phone</Label><Input value={personData.phone} onChange={(e) => setPersonData({ phone: e.target.value })} className={inputCls} /></div>
                  <div className="space-y-1"><Label className="text-[10px]">Email</Label><Input value={personData.email} onChange={(e) => setPersonData({ email: e.target.value })} className={inputCls} /></div>
                  <div className="col-span-2 space-y-1"><Label className="text-[10px]">Address</Label><Input value={personData.address} onChange={(e) => setPersonData({ address: e.target.value })} className={inputCls} /></div>
                  <div className="space-y-1"><Label className="text-[10px]">DOB</Label><Input type="date" value={personData.dateOfBirth} onChange={(e) => setPersonData({ dateOfBirth: e.target.value })} className={inputCls} /></div>
                  <div className="space-y-1"><Label className="text-[10px]">Section</Label><Input value={personData.section} onChange={(e) => setPersonData({ section: e.target.value })} className={inputCls} /></div>
                  {personType === 'student' && (
                    <>
                      <div className="space-y-1"><Label className="text-[10px]">House</Label><Input value={personData.house} onChange={(e) => setPersonData({ house: e.target.value })} className={inputCls} /></div>
                      <div className="space-y-1"><Label className="text-[10px]">Session</Label><Input value={personData.academicSession} onChange={(e) => setPersonData({ academicSession: e.target.value })} className={inputCls} /></div>
                    </>
                  )}
                  {personType === 'teacher' && (
                    <div className="space-y-1"><Label className="text-[10px]">Designation</Label><Input value={personData.designation} onChange={(e) => setPersonData({ designation: e.target.value })} className={inputCls} /></div>
                  )}
                  {personType === 'staff' && (
                    <div className="space-y-1"><Label className="text-[10px]">Position</Label><Input value={personData.position} onChange={(e) => setPersonData({ position: e.target.value })} className={inputCls} /></div>
                  )}
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="text-[10px] font-medium">Uploads</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Logo', value: logoFile, setter: setLogoFile, icon: Building2 },
                      { label: 'Photo', value: photoFile, setter: setPhotoFile, icon: Camera },
                      { label: 'Signature', value: signatureFile, setter: setSignatureFile, icon: ImageIcon },
                    ].map((item) => (
                      <div key={item.label}>
                        <Label className="text-[9px] text-muted-foreground">{item.label}</Label>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Button variant="outline" size="sm" className="h-6 w-6 p-0"
                            onClick={() => {
                              const input = document.createElement('input');
                              input.type = 'file'; input.accept = 'image/*';
                              input.onchange = (e: any) => {
                                const file = e.target?.files?.[0];
                                if (file) { const reader = new FileReader(); reader.onload = () => item.setter(reader.result as string); reader.readAsDataURL(file); }
                              };
                              input.click();
                            }}>
                            {item.value ? <Check className="size-3 text-emerald-500" /> : <Plus className="size-3" />}
                          </Button>
                          {item.value && (
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => item.setter(null)}>
                              <X className="size-3 text-red-400" />
                            </Button>
                          )}
                          <span className="text-[9px] text-muted-foreground truncate max-w-[40px]">{item.value ? 'Set' : 'Add'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Design Tab */}
          <TabsContent value="design" className="space-y-2.5 mt-2">
            <Card className="border shadow-none">
              <CardContent className="p-3 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-medium">Orientation</Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button variant={design.orientation === 'landscape' ? 'default' : 'outline'} size="sm" onClick={() => setDesign({ orientation: 'landscape' })} className="h-7 text-[10px]">
                      <Maximize2 className="size-2.5 mr-1" />Landscape
                    </Button>
                    <Button variant={design.orientation === 'portrait' ? 'default' : 'outline'} size="sm" onClick={() => setDesign({ orientation: 'portrait' })} className="h-7 text-[10px]">
                      <Maximize2 className="size-2.5 mr-1 rotate-90" />Portrait
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-medium">Font Size</Label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {FONT_SIZES.map((f) => (
                      <Button key={f.value} variant={design.fontSize === f.value ? 'default' : 'outline'} size="sm" onClick={() => setDesign({ fontSize: f.value })} className="h-7 text-[10px]">
                        <Type className="size-2.5 mr-1" />{f.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-medium">Color Theme</Label>
                  <Tabs value={activeColorTab} onValueChange={setActiveColorTab}>
                    <TabsList className="h-6">
                      <TabsTrigger value="presets" className="text-[9px] px-2">Presets</TabsTrigger>
                      <TabsTrigger value="custom" className="text-[9px] px-2">Custom</TabsTrigger>
                    </TabsList>
                    <TabsContent value="presets" className="mt-1.5">
                      <div className="grid grid-cols-4 gap-1.5">
                        {colorPresets.map((preset) => (
                          <button
                            key={preset.name}
                            type="button"
                            title={preset.name}
                            onClick={() => setDesign({ colors: { ...design.colors, ...preset.colors } })}
                            className={cn(
                              'w-full aspect-[2/1] rounded-md border-2 transition-all',
                              JSON.stringify(design.colors) === JSON.stringify({ ...design.colors, ...preset.colors }) ? 'border-foreground ring-1 ring-foreground scale-105' : 'border-transparent hover:border-gray-300'
                            )}
                          >
                            <div className="w-full h-full rounded-[3px]" style={{ background: `linear-gradient(135deg, ${preset.colors.primary}, ${preset.colors.secondary})` }} />
                          </button>
                        ))}
                      </div>
                    </TabsContent>
                    <TabsContent value="custom" className="mt-1.5">
                      <div className="grid grid-cols-4 gap-1.5">
                        {[
                          { label: 'Primary', key: 'primary' as const },
                          { label: 'Secondary', key: 'secondary' as const },
                          { label: 'Accent', key: 'accent' as const },
                          { label: 'Header', key: 'headerBg' as const },
                          { label: 'Text', key: 'text' as const },
                          { label: 'Muted', key: 'textSecondary' as const },
                          { label: 'Background', key: 'bg' as const },
                        ].map((c) => (
                          <div key={c.key} className="space-y-0.5">
                            <Label className="text-[8px] text-muted-foreground">{c.label}</Label>
                            <Input type="color" value={design.colors[c.key]} onChange={(e) => setDesign({ colors: { ...design.colors, [c.key]: e.target.value } })}
                              className="h-6 p-0.5 cursor-pointer" />
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="text-[10px] font-medium">Show/Hide Elements</Label>
                  {[
                    { label: 'Profile Photo', key: 'showPhoto' as const, icon: Camera },
                    { label: 'School Logo', key: 'showLogo' as const, icon: Building2 },
                    { label: 'QR Code', key: 'showQRCode' as const, icon: QrCode },
                    { label: 'Barcode', key: 'showBarcode' as const, icon: Hash },
                    { label: 'Signature', key: 'showSignature' as const, icon: ImageIcon },
                    { label: 'Watermark', key: 'showWatermark' as const, icon: FileImage },
                    { label: 'School Motto', key: 'showMotto' as const, icon: Sparkles },
                    { label: 'Expiry Date', key: 'showExpiryDate' as const, icon: CreditCard },
                    { label: 'Issue Date', key: 'showIssueDate' as const, icon: CalendarIcon },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between">
                      <Label className="text-[10px] flex items-center gap-1.5">
                        <item.icon className="size-2.5" /> {item.label}
                      </Label>
                      <Switch checked={design[item.key] as boolean} onCheckedChange={(v) => setDesign({ [item.key]: v })} />
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="text-[10px] font-medium">Save Design</Label>
                  <div className="flex gap-1.5 items-center">
                    <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Design name..." className="h-7 text-xs flex-1" />
                    <Button size="sm" onClick={handleSaveDesign} disabled={saving} className="h-7 text-[10px] px-2">
                      {saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3 mr-1" />}
                      Save
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Back Tab */}
          <TabsContent value="back" className="space-y-2.5 mt-2">
            <Card className="border shadow-none">
              <CardContent className="p-3 space-y-3">
                <div className="space-y-1">
                  <Label className="text-[10px] font-medium">Back Card Content</Label>
                  <Textarea value={design.backText} onChange={(e) => setDesign({ backText: e.target.value })}
                    className="min-h-[120px] text-xs resize-none" />
                  <p className="text-[9px] text-muted-foreground">Use {'{name}'}, {'{id}'}, {'{company}'} as placeholders</p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="text-[10px] font-medium">Back Layout Sections</Label>
                  {[
                    { label: 'Emergency Info', key: 'showEmergencyInfo' as const },
                    { label: 'Medical Info', key: 'showMedicalInfo' as const },
                    { label: 'Terms & Conditions', key: 'showTerms' as const },
                    { label: 'Authorized Signatory', key: 'showSignatory' as const },
                    { label: 'School Info', key: 'showSchoolInfo' as const },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between">
                      <Label className="text-[10px]">{item.label}</Label>
                      <Switch checked={design[item.key] as boolean} onCheckedChange={(v) => setDesign({ [item.key]: v })} />
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-medium">QR Position</Label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['front', 'back', 'both'] as const).map((pos) => (
                      <Button key={pos} variant={design.qrPosition === pos ? 'default' : 'outline'} size="sm"
                        onClick={() => setDesign({ qrPosition: pos })} className="h-7 text-[10px] capitalize">
                        {pos}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Export Tab */}
          <TabsContent value="export" className="space-y-2.5 mt-2">
            <Card className="border shadow-none">
              <CardContent className="p-3 space-y-3">
                <IDCardQuickExport />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* RIGHT: Preview */}
      <div className="flex flex-col items-center justify-start gap-3 pt-2">
        <div className="flex items-center gap-2">
          <Button variant={cardSide === 'front' ? 'default' : 'outline'} size="sm" onClick={() => setCardSide('front')} className="h-7 text-xs">
            <Eye className="size-3 mr-1" /> Front
          </Button>
          <Button variant={cardSide === 'back' ? 'default' : 'outline'} size="sm" onClick={() => setCardSide('back')} className="h-7 text-xs">
            <EyeOff className="size-3 mr-1" /> Back
          </Button>
          <Badge variant="outline" className="text-[9px] ml-2">
            {design.orientation === 'landscape' ? '85.6 x 53.98 mm' : '53.98 x 85.6 mm'}
          </Badge>
        </div>

        <IDCardPreview />

        <div className="flex items-center gap-2 mt-1">
          <Button onClick={handleQuickExport('png')} size="sm" className="h-8 text-xs">
            <FileImage className="size-3.5 mr-1.5" /> PNG
          </Button>
          <Button onClick={handleQuickExport('pdf')} size="sm" className="h-8 text-xs">
            <Download className="size-3.5 mr-1.5" /> PDF
          </Button>
          <Button onClick={handlePrint} size="sm" variant="outline" className="h-8 text-xs">
            <Printer className="size-3.5 mr-1.5" /> Print
          </Button>
        </div>
      </div>
    </div>
  );

  function CalendarIcon({ className }: { className?: string }) {
    return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
  }

  function handleQuickExport(format: string) {
    return async () => {
      try {
        const res = await fetch('/api/id-cards/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            format,
            scope: 'both',
            orientation: design.orientation,
            cards: [{
              type: personType,
              personId: selectedPersonId || 'preview',
              name: personData.fullName || 'Unknown',
              displayId: personData.displayId || 'N/A',
              role: personData.role,
              class: personData.className || personData.department,
              phone: personData.phone,
              gender: personData.bloodGroup,
              photo: photoFile,
              userId: currentUser.id,
            }],
          }),
        });
        if (!res.ok) throw new Error('Export failed');
        const blob = await res.blob();
        const ext = format === 'pdf' ? 'pdf' : 'zip';
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `ID-Card-${personData.fullName || 'Card'}.${ext}`;
        link.click();
        toast.success(`${format.toUpperCase()} downloaded`);
      } catch {
        toast.error('Export failed');
      }
    };
  }

  function handlePrint() {
    const previewEl = document.querySelector('[data-card-preview]');
    if (!previewEl) { toast.error('No card to print'); return; }
    const win = window.open('', '_blank');
    if (!win) { toast.error('Popup blocked'); return; }
    const imgSrc = previewSrc || (previewEl.querySelector('img')?.src || '');
    win.document.write(`<img src="${imgSrc}" style="max-width:100%;" onload="window.print();window.close();" />`);
  }
}
