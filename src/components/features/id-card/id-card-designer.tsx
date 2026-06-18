'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app-store';
import { useIDCardStore } from '@/store/id-card-store';
import { BLOOD_GROUPS } from '@/lib/id-card-utils/constants';
import { IDCardPreview } from './id-card-preview';
import { toast } from 'sonner';
import {
  User, Palette, RotateCcw, Check, Camera, Building2,
  QrCode, Image as ImageIcon, FileImage, Download, Printer,
  GraduationCap, Briefcase, Presentation, Crown, Save,
  X, Plus, ChevronDown,
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
    previewSrc,
    previewLoading, setPreviewLoading,
    setPreviewSrc,
  } = store;

  const [people, setPeople] = useState<any[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [saving, setSaving] = useState(false);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        type: personType, name,
        displayId: personData.displayId || 'STU-001',
        className: personData.className || '', section: personData.section || '',
        department: personData.department || '', gender: personData.gender || '',
        phone: personData.phone || '', email: personData.email || '',
        address: personData.address || '', bloodGroup: personData.bloodGroup || '',
        dateOfBirth: personData.dateOfBirth || '', house: personData.house || '',
        academicSession: personData.academicSession || '',
        designation: personData.designation || '', position: personData.position || '',
        role: personData.role || (personType === 'student' ? 'STUDENT' : personType === 'teacher' ? 'TEACHER' : 'STAFF'),
        colors: p,
        showPhoto: design.showPhoto, showLogo: design.showLogo,
        showQR: design.showQRCode, showSignature: design.showSignature,
        showWatermark: design.showWatermark, showMotto: design.showMotto,
        showExpiryDate: design.showExpiryDate, showIssueDate: design.showIssueDate,
        orientation: design.orientation,
        isBack: cardSide === 'back',
        backText: design.backText || '',
        issueDate: design.showIssueDate ? new Date().toISOString().split('T')[0] : null,
        expiryDate: design.showExpiryDate ? new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0] : null,
        watermarkText: design.showWatermark ? (design.watermarkText || currentUser.schoolName || '') : null,
        qrColor: p.primary,
        showTerms: design.showTerms,
        showMedicalInfo: design.showMedicalInfo,
        showEmergencyInfo: design.showEmergencyInfo,
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
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: 'Preview failed' }));
        toast.error(errBody.error || `Preview failed (${res.status})`);
        return;
      }
      const json = await res.json();
      if (json.data) setPreviewSrc(`data:image/png;base64,${json.data}`);
    } catch { toast.error('Preview error'); }
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
          action: 'save', name: design.name,
          orientation: design.orientation,
          primaryColor: design.colors.primary,
          showPhoto: design.showPhoto, showLogo: design.showLogo,
          showQRCode: design.showQRCode, showSignature: design.showSignature,
          showMotto: design.showMotto,
          watermarkText: design.watermarkText,
        }),
      });
      if (res.ok) toast.success('Design saved');
      else toast.error('Failed to save design');
    } catch {
      toast.error('Error saving design');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'h-7 text-xs';

  const uploadBtn = (label: string, value: string | null, setter: (v: string | null) => void, icon: React.ElementType) => (
    <div key={label}>
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-1 mt-0.5">
        <Button variant="outline" size="sm" className="h-6 w-6 p-0"
          onClick={() => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.onchange = (e: any) => { const f = e.target?.files?.[0]; if (f) { const r = new FileReader(); r.onload = () => setter(r.result as string); r.readAsDataURL(f); } }; inp.click(); }}>
          {value ? <Check className="size-3 text-emerald-500" /> : <Plus className="size-3" />}
        </Button>
        {value && <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setter(null)}><X className="size-3 text-red-400" /></Button>}
        <span className="text-[10px] text-muted-foreground truncate max-w-[50px]">{value ? 'Set' : 'Add'}</span>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-4">
      <div className="space-y-3 max-h-[calc(100vh-160px)] overflow-y-auto pr-1 scrollbar-thin">
        <Collapsible defaultOpen={true}>
          <CollapsibleTrigger className="flex w-full items-center gap-2 py-1.5 text-xs font-semibold text-foreground">
            <User className="size-3.5" />Person Info <ChevronDown className="size-3 ml-auto" />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2.5 pt-2">
            <div className="grid grid-cols-2 gap-1.5">
              {([{ value: 'student', label: 'Student', icon: GraduationCap },
                { value: 'teacher', label: 'Teacher', icon: Presentation },
                { value: 'staff', label: 'Staff', icon: Briefcase },
                { value: 'executive', label: 'Executive', icon: Crown },
              ] as const).map((t) => (
                <Button key={t.value} type="button" variant={personType === t.value ? 'default' : 'outline'} size="sm" onClick={() => setPersonType(t.value)} className="h-7 text-[10px]">
                  <t.icon className="size-3 mr-1" />{t.label}
                </Button>
              ))}
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-medium">From Database</Label>
              <select value={selectedPersonId} onChange={(e) => handleSelectPerson(e.target.value)} disabled={loadingPeople}
                className="flex h-7 w-full rounded-md border border-input bg-background px-2 text-xs">
                <option value="">-- Manual Entry --</option>
                {people.map((p) => (<option key={p.id || p.userId} value={p.id || p.userId}>
                  {personType === 'student' ? `${p.user?.name || 'Unknown'} (${p.admissionNo || 'N/A'})` : `${p.name || 'Unknown'} (${p.employeeNo || p.displayId || 'N/A'})`}
                </option>))}
              </select>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="text-[10px]">Full Name</Label><Input value={personData.fullName} onChange={(e) => setPersonData({ fullName: e.target.value })} className={inputCls} /></div>
              <div className="space-y-1"><Label className="text-[10px]">ID No.</Label><Input value={personData.displayId} onChange={(e) => setPersonData({ displayId: e.target.value })} className={inputCls} /></div>
              <div className="space-y-1"><Label className="text-[10px]">Role</Label><Input value={personData.role} onChange={(e) => setPersonData({ role: e.target.value })} className={inputCls} /></div>
              <div className="space-y-1"><Label className="text-[10px]">Class/Dept</Label><Input value={personData.className || personData.department} onChange={(e) => setPersonData({ className: e.target.value, department: e.target.value })} className={inputCls} /></div>
              <div className="space-y-1"><Label className="text-[10px]">Blood Group</Label>
                <select value={personData.bloodGroup} onChange={(e) => setPersonData({ bloodGroup: e.target.value })} className="flex h-7 w-full rounded-md border border-input bg-background px-2 text-xs">
                  {BLOOD_GROUPS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="space-y-1"><Label className="text-[10px]">Gender</Label><Input value={personData.gender} onChange={(e) => setPersonData({ gender: e.target.value })} className={inputCls} /></div>
              <div className="space-y-1"><Label className="text-[10px]">Phone</Label><Input value={personData.phone} onChange={(e) => setPersonData({ phone: e.target.value })} className={inputCls} /></div>
              <div className="space-y-1"><Label className="text-[10px]">Section</Label><Input value={personData.section} onChange={(e) => setPersonData({ section: e.target.value })} className={inputCls} /></div>
              <div className="col-span-2 space-y-1"><Label className="text-[10px]">Address</Label><Input value={personData.address} onChange={(e) => setPersonData({ address: e.target.value })} className={inputCls} /></div>
              <div className="space-y-1"><Label className="text-[10px]">DOB</Label><Input type="date" value={personData.dateOfBirth} onChange={(e) => setPersonData({ dateOfBirth: e.target.value })} className={inputCls} /></div>
              {personType === 'student' && (<><div className="space-y-1"><Label className="text-[10px]">House</Label><Input value={personData.house} onChange={(e) => setPersonData({ house: e.target.value })} className={inputCls} /></div><div className="space-y-1"><Label className="text-[10px]">Session</Label><Input value={personData.academicSession} onChange={(e) => setPersonData({ academicSession: e.target.value })} className={inputCls} /></div></>)}
              {personType === 'teacher' && (<div className="space-y-1"><Label className="text-[10px]">Designation</Label><Input value={personData.designation} onChange={(e) => setPersonData({ designation: e.target.value })} className={inputCls} /></div>)}
              {personType === 'staff' && (<div className="space-y-1"><Label className="text-[10px]">Position</Label><Input value={personData.position} onChange={(e) => setPersonData({ position: e.target.value })} className={inputCls} /></div>)}
            </div>
            <Separator />
            <div className="grid grid-cols-3 gap-2">
              {uploadBtn('Logo', logoFile, setLogoFile, Building2)}
              {uploadBtn('Photo', photoFile, setPhotoFile, Camera)}
              {uploadBtn('Signature', signatureFile, setSignatureFile, ImageIcon)}
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        <Collapsible defaultOpen={true}>
          <CollapsibleTrigger className="flex w-full items-center gap-2 py-1.5 text-xs font-semibold text-foreground">
            <Palette className="size-3.5" />Card Design <ChevronDown className="size-3 ml-auto" />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2.5 pt-2">
            {/* Orientation */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-medium">Orientation</Label>
              <div className="flex gap-1.5">
                <Button variant={design.orientation === 'landscape' ? 'default' : 'outline'} size="sm" onClick={() => setDesign({ orientation: 'landscape' })} className="flex-1 h-7 text-[10px]">Landscape</Button>
                <Button variant={design.orientation === 'portrait' ? 'default' : 'outline'} size="sm" onClick={() => setDesign({ orientation: 'portrait' })} className="flex-1 h-7 text-[10px]">Portrait</Button>
              </div>
            </div>
            <Separator />

            {/* Color */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-medium">Primary Color</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={design.colors.primary}
                  onChange={(e) => setDesign({ colors: { ...design.colors, primary: e.target.value } })}
                  className="size-8 rounded border cursor-pointer p-0.5" />
                <span className="text-xs text-muted-foreground font-mono">{design.colors.primary}</span>
              </div>
            </div>
            <Separator />

            {/* Front Elements */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-medium">Front Elements</Label>
              <div className="space-y-1">
                {[
                  { label: 'Photo', key: 'showPhoto' as const, icon: Camera },
                  { label: 'School Logo', key: 'showLogo' as const, icon: Building2 },
                  { label: 'QR Code', key: 'showQRCode' as const, icon: QrCode },
                  { label: 'Signature', key: 'showSignature' as const, icon: ImageIcon },
                  { label: 'Motto', key: 'showMotto' as const, icon: FileImage },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between">
                    <span className="text-xs flex items-center gap-1.5"><item.icon className="size-3 text-muted-foreground" />{item.label}</span>
                    <Switch checked={design[item.key]} onCheckedChange={(v) => setDesign({ [item.key]: v })} />
                  </div>
                ))}
              </div>
            </div>
            <Separator />

            {/* Save */}
            <div className="space-y-2">
              <Button size="sm" onClick={handleSaveDesign} disabled={saving} className="w-full h-7 text-xs">
                {saving ? 'Saving...' : <><Save className="size-3 mr-1" />Save Design</>}
              </Button>
              <Button size="sm" variant="outline" onClick={() => store.resetDesign()} className="w-full h-7 text-xs">
                <RotateCcw className="size-3 mr-1" />Reset
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* RIGHT: Preview */}
      <div className="flex flex-col items-center justify-start gap-3 pt-2">
        <div className="flex items-center gap-2">
          <Button variant={cardSide === 'front' ? 'default' : 'outline'} size="sm" onClick={() => setCardSide('front')} className="h-7 text-xs">
            Front
          </Button>
          <Button variant={cardSide === 'back' ? 'default' : 'outline'} size="sm" onClick={() => setCardSide('back')} className="h-7 text-xs">
            Back
          </Button>
          <Badge variant="outline" className="text-[10px] ml-2">
            {design.orientation === 'landscape' ? '85.6 x 53.98 mm' : '53.98 x 85.6 mm'}
          </Badge>
        </div>

        <IDCardPreview />

        <div className="flex items-center gap-2 mt-1">
          <Button size="sm" className="h-8 text-xs" onClick={async () => {
            try {
              const res = await fetch('/api/id-cards/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ format: 'png', scope: 'both', orientation: design.orientation, cards: [{ type: personType, personId: selectedPersonId || 'preview', name: personData.fullName || 'Unknown', displayId: personData.displayId || 'N/A', role: personData.role, class: personData.className || personData.department, phone: personData.phone, gender: personData.bloodGroup, photo: photoFile, userId: currentUser.id }] }) });
              if (!res.ok) throw new Error('Export failed');
              const blob = await res.blob();
              const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `ID-Card-${personData.fullName || 'Card'}.zip`; link.click();
              toast.success('PNG downloaded');
            } catch { toast.error('Export failed'); }
          }}>
            <Download className="size-3.5 mr-1.5" /> Export
          </Button>
        </div>
      </div>
    </div>
  );
}