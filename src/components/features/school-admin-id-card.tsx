'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { toPng } from 'html-to-image';
import QRCodeLib from 'qrcode';
import { jsPDF } from 'jspdf';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import {
  Download, Printer, Palette, RotateCcw,
  CreditCard, FileImage, Loader2, Eye, EyeOff,
  Search, Users, CheckSquare,
} from 'lucide-react';

const PREVIEW_SCALE = 4.2;
const EXPORT_SCALE = 8;
const ROUNDED = 3.5;

type CardType = 'staff' | 'student';
type CardSide = 'front' | 'back';
type Orientation = 'landscape' | 'portrait';

interface FormData {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  department: string;
  idNumber: string;
  dateOfBirth: string;
  bloodGroup: string;
  phone: string;
  email: string;
  address: string;
  photoUrl: string;
}

interface ColorTheme {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  textSecondary: string;
  headerBg: string;
  bg: string;
  gradient: string;
}

const COLOR_THEMES: ColorTheme[] = [
  { name: 'Emerald', primary: '#059669', secondary: '#34d399', accent: '#fbbf24', text: '#0f172a', textSecondary: '#64748b', headerBg: '#059669', bg: '#ffffff', gradient: 'from-emerald-600 to-emerald-500' },
  { name: 'Royal Blue', primary: '#1d4ed8', secondary: '#60a5fa', accent: '#f59e0b', text: '#0f172a', textSecondary: '#64748b', headerBg: '#1d4ed8', bg: '#ffffff', gradient: 'from-blue-600 to-blue-500' },
  { name: 'Crimson', primary: '#dc2626', secondary: '#f87171', accent: '#fcd34d', text: '#0f172a', textSecondary: '#64748b', headerBg: '#dc2626', bg: '#ffffff', gradient: 'from-red-600 to-red-500' },
  { name: 'Purple', primary: '#7c3aed', secondary: '#a78bfa', accent: '#34d399', text: '#0f172a', textSecondary: '#64748b', headerBg: '#7c3aed', bg: '#ffffff', gradient: 'from-purple-600 to-purple-500' },
  { name: 'Teal', primary: '#0d9488', secondary: '#5eead4', accent: '#fbbf24', text: '#0f172a', textSecondary: '#64748b', headerBg: '#0d9488', bg: '#ffffff', gradient: 'from-teal-600 to-teal-500' },
  { name: 'Amber', primary: '#d97706', secondary: '#fbbf24', accent: '#3b82f6', text: '#0f172a', textSecondary: '#64748b', headerBg: '#d97706', bg: '#ffffff', gradient: 'from-amber-600 to-amber-500' },
  { name: 'Slate', primary: '#334155', secondary: '#94a3b8', accent: '#0ea5e9', text: '#0f172a', textSecondary: '#64748b', headerBg: '#334155', bg: '#ffffff', gradient: 'from-slate-600 to-slate-500' },
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

interface PersonRecord {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  role: string;
  department: string;
  idNumber: string;
  dateOfBirth: string;
  bloodGroup: string;
  phone: string;
  email: string;
  address: string;
  photoUrl: string;
  personType: 'student' | 'teacher';
}

const EMPTY_FORM: FormData = {
  id: '', firstName: '', lastName: '', role: '', department: '',
  idNumber: '', dateOfBirth: '', bloodGroup: 'O+', phone: '',
  email: '', address: '', photoUrl: '',
};

function fmtDate(d: string): string {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

function mmPx(mm: number, scale: number): number { return mm * scale; }

async function generateQR(text: string, size: number): Promise<string> {
  if (!text) return '';
  try {
    return await QRCodeLib.toDataURL(text, {
      width: size, margin: 1, color: { dark: '#1a1a2e', light: '#ffffff' },
    });
  } catch { return ''; }
}

export function SchoolAdminIDCards() {
  const { currentUser } = useAppStore();
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [cardType, setCardType] = useState<CardType>('student');
  const [logoFile, setLogoFile] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<string | null>(null);
  const [signatureFile, setSignatureFile] = useState<string | null>(null);
  const [theme, setTheme] = useState<ColorTheme>(COLOR_THEMES[0]);
  const [side, setSide] = useState<CardSide>('front');
  const [orientation, setOrientation] = useState<Orientation>('landscape');
  const [showPhoto, setShowPhoto] = useState(true);
  const [showLogo, setShowLogo] = useState(true);
  const [showQR, setShowQR] = useState(true);
  const [showWatermark, setShowWatermark] = useState(true);
  const [backText, setBackText] = useState(
    '1. This card is official property of {company}.\n2. It must be presented upon request by authorities.\n3. Loss of this card must be reported immediately.\n4. If found, please return to the nearest office.'
  );
  const [qrData, setQrData] = useState<string>('');
  const [fullscreen, setFullscreen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Student/staff fetch state
  const [persons, setPersons] = useState<PersonRecord[]>([]);
  const [loadingPersons, setLoadingPersons] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPersonIds, setSelectedPersonIds] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [classFilter, setClassFilter] = useState('');
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);

  const cardRef = useRef<HTMLDivElement>(null);
  const schoolId = currentUser?.schoolId || '';
  const schoolName = currentUser?.schoolName || 'Skoolar International Academy';
  const cardW = orientation === 'landscape' ? 85.6 : 53.98;
  const cardH = orientation === 'landscape' ? 53.98 : 85.6;
  const pw = mmPx(cardW, PREVIEW_SCALE);
  const ph = mmPx(cardH, PREVIEW_SCALE);

  // Load classes for filtering
  useEffect(() => {
    if (!schoolId) return;
    fetch(`/api/classes?schoolId=${schoolId}`)
      .then(r => r.json())
      .then(data => setClasses(data.data || data.classes || []))
      .catch(() => {});
  }, [schoolId]);

  const updateForm = (key: keyof FormData, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  useEffect(() => {
    const text = `${form.firstName} ${form.lastName} | ID: ${form.idNumber} | ${schoolName}`;
    generateQR(text, 300).then(setQrData);
  }, [form, schoolName]);

  const fetchPersons = useCallback(async () => {
    if (!schoolId) return;
    setLoadingPersons(true);
    try {
      const params = new URLSearchParams({ schoolId, limit: '200' });
      if (classFilter) params.set('classId', classFilter);
      const endpoint = cardType === 'student' ? '/api/students' : '/api/teachers';
      const res = await fetch(`${endpoint}?${params}`);
      const data = await res.json();
      const items = (data.data || data.students || data.teachers || data || []);
      const mapped: PersonRecord[] = items.map((p: any) => {
        const name = p.user?.name || p.fullName || `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Unknown';
        const nameParts = name.split(' ');
        return {
          id: p.id,
          name,
          firstName: nameParts[0] || '',
          lastName: nameParts.slice(1).join(' ') || '',
          role: p.role || p.personType || cardType,
          department: p.class?.name || p.department || p.className || '',
          idNumber: p.admissionNo || p.staffId || p.employeeId || '',
          dateOfBirth: p.dateOfBirth || p.dob || '',
          bloodGroup: p.bloodGroup || 'O+',
          phone: p.phone || p.user?.phone || '',
          email: p.email || p.user?.email || '',
          address: p.address || p.user?.address || '',
          photoUrl: p.user?.image || p.photo || '',
          personType: cardType,
        };
      });
      setPersons(mapped);
    } catch { toast.error('Failed to load records'); }
    finally { setLoadingPersons(false); }
  }, [schoolId, cardType, classFilter]);

  const selectPerson = (person: PersonRecord) => {
    setForm({
      id: person.id,
      firstName: person.firstName,
      lastName: person.lastName,
      role: person.role,
      department: person.department,
      idNumber: person.idNumber,
      dateOfBirth: person.dateOfBirth,
      bloodGroup: person.bloodGroup || 'O+',
      phone: person.phone,
      email: person.email,
      address: person.address,
      photoUrl: person.photoUrl,
    });
    if (person.photoUrl) setPhotoFile(person.photoUrl);
    setBulkMode(false);
  };

  const togglePersonSelection = (id: string) => {
    const next = new Set(selectedPersonIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedPersonIds(next);
  };

  const filteredPersons = persons.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.idNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleReset = () => {
    setForm(EMPTY_FORM);
    setPhotoFile(null);
    setSignatureFile(null);
    setSelectedPersonIds(new Set());
    toast.success('Reset complete');
  };

  const renderCard = () => {
    const s = PREVIEW_SCALE;
    const c = theme;
    const isLand = orientation === 'landscape';
    const prim = c.primary;
    const primD = c.headerBg;
    const dark = c.text;
    const muted = c.textSecondary;
    const displayName = `${form.firstName} ${form.lastName}`.trim() || 'Full Name';
    const initials = (form.firstName[0] || '') + (form.lastName[0] || '');
    const photo = photoFile || form.photoUrl;

    if (side === 'back') {
      const parsedText = backText.replace(/\{company\}/g, schoolName);
      return (
        <div style={{ width: '100%', height: '100%', background: c.bg, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: `linear-gradient(${prim}05 1px, transparent 1px), linear-gradient(90deg, ${prim}05 1px, transparent 1px)`, backgroundSize: mmPx(5, s) + 'px ' + mmPx(5, s) + 'px' }} />
          <div style={{ height: mmPx(isLand ? 12 : 18, s), background: prim, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: mmPx(isLand ? 2.2 : 2, s), textTransform: 'uppercase', letterSpacing: '1px', position: 'relative' }}>Terms of Use</div>
          <div style={{ padding: mmPx(4, s), position: 'relative' }}>
            <div style={{ color: dark, fontSize: mmPx(isLand ? 1.4 : 1.3, s), lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{parsedText}</div>
          </div>
          <div style={{ position: 'absolute', bottom: mmPx(4, s), right: mmPx(6, s), textAlign: 'center' }}>
            {signatureFile && <img src={signatureFile} style={{ height: mmPx(6, s), objectFit: 'contain', marginBottom: mmPx(1, s) }} />}
            <div style={{ width: '100%', height: '0.2px', background: dark, opacity: 0.3 }} />
            <div style={{ fontSize: mmPx(1.2, s), fontWeight: 800, color: muted, textTransform: 'uppercase', marginTop: mmPx(1, s) }}>Authorized Signatory</div>
          </div>
        </div>
      );
    }

    return (
      <div style={{ width: '100%', height: '100%', background: c.bg, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: `radial-gradient(${prim}08 1px, transparent 1px)`, backgroundSize: mmPx(4, s) + 'px ' + mmPx(4, s) + 'px' }} />
        <div style={{ position: 'absolute', top: 0, left: 0, width: mmPx(4, s), bottom: 0, background: `linear-gradient(180deg, ${primD}, ${prim})` }} />
        <div style={{ position: 'absolute', top: 0, left: mmPx(4, s), right: 0, height: mmPx(16, s), display: 'flex', alignItems: 'center', padding: `0 ${mmPx(4, s)}px` }}>
          {showLogo && logoFile && <img src={logoFile} style={{ width: mmPx(10, s), height: mmPx(10, s), borderRadius: mmPx(2, s), objectFit: 'contain', marginRight: mmPx(3, s) }} />}
          <div style={{ flex: 1 }}>
            <div style={{ color: dark, fontWeight: 900, fontSize: mmPx(isLand ? 3.5 : 2.8, s), textTransform: 'uppercase' }}>{schoolName}</div>
            <div style={{ color: muted, fontSize: mmPx(1.6, s), fontStyle: 'italic' }}>E-Learning & Management System</div>
          </div>
        </div>
        <div style={{ position: 'absolute', top: mmPx(16, s), left: mmPx(4, s), right: 0, bottom: mmPx(6, s), display: 'flex', alignItems: 'center', padding: `0 ${mmPx(4, s)}px`, gap: mmPx(5, s) }}>
          {showPhoto && (
            <div style={{ width: mmPx(24, s), height: mmPx(28, s), borderRadius: mmPx(3, s), overflow: 'hidden', border: `1.5px solid ${prim}20`, background: `${prim}05`, boxShadow: '0 2mm 4mm rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {photo ? <img src={photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: mmPx(8, s), fontWeight: 900, color: prim, opacity: 0.2 }}>{initials || '?'}</span>}
            </div>
          )}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: mmPx(1.5, s) }}>
            <div style={{ color: dark, fontWeight: 900, fontSize: mmPx(isLand ? 4.8 : 4, s) }}>{displayName}</div>
            <div style={{ background: prim, color: 'white', padding: '0.6mm 2.5mm', borderRadius: '1mm', fontSize: mmPx(1.8, s), fontWeight: 800, display: 'inline-block', alignSelf: 'flex-start', textTransform: 'uppercase' }}>{cardType}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: mmPx(3, s), rowGap: mmPx(0.8, s), marginTop: mmPx(1.5, s) }}>
              <span style={{ color: muted, fontSize: mmPx(1.5, s), fontWeight: 800, textTransform: 'uppercase' }}>ID No</span>
              <span style={{ color: dark, fontSize: mmPx(1.8, s), fontWeight: 600 }}>{form.idNumber || '—'}</span>
              <span style={{ color: muted, fontSize: mmPx(1.5, s), fontWeight: 800, textTransform: 'uppercase' }}>{isLand ? 'Dept' : 'Class'}</span>
              <span style={{ color: dark, fontSize: mmPx(1.8, s), fontWeight: 600 }}>{form.department || '—'}</span>
            </div>
          </div>
          {showQR && qrData && <div style={{ width: mmPx(14, s), height: mmPx(14, s) }}><img src={qrData} style={{ width: '100%', height: '100%', borderRadius: mmPx(1, s) }} /></div>}
        </div>
        <div style={{ position: 'absolute', bottom: 0, left: mmPx(4, s), right: 0, height: mmPx(6, s), borderTop: `0.5px solid ${prim}10`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `0 ${mmPx(4, s)}px` }}>
          <div style={{ color: muted, fontSize: mmPx(1.6, s), fontWeight: 700 }}>OFFICIAL IDENTITY CARD</div>
          <div style={{ background: '#fbbf24', color: 'black', padding: '0.5mm 1.5mm', borderRadius: '1mm', fontSize: mmPx(1.6, s), fontWeight: 900 }}>BLOOD: {form.bloodGroup || '—'}</div>
        </div>
        {showWatermark && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-25deg)', fontSize: mmPx(12, s), fontWeight: 900, color: prim, opacity: 0.03, whiteSpace: 'nowrap', textTransform: 'uppercase' }}>{schoolName}</div>}
      </div>
    );
  };

  const handleExportPNG = useCallback(async () => {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      const scale = EXPORT_SCALE / PREVIEW_SCALE;
      const dataUrl = await toPng(cardRef.current, { quality: 1, pixelRatio: scale, cacheBust: true });
      const link = document.createElement('a');
      link.download = `ID-${form.firstName || 'card'}-${side}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('PNG downloaded');
    } catch { toast.error('Export failed'); } finally { setExporting(false); }
  }, [form, side]);

  const handleExportPDF = useCallback(async () => {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      const scale = EXPORT_SCALE / PREVIEW_SCALE;
      const dataUrl = await toPng(cardRef.current, { quality: 1, pixelRatio: scale, cacheBust: true });
      const pdf = new jsPDF({ orientation: orientation === 'portrait' ? 'portrait' : 'landscape', unit: 'mm', format: [cardW, cardH] });
      pdf.addImage(dataUrl, 'PNG', 0, 0, cardW, cardH);
      pdf.save(`ID-${form.firstName || 'card'}.pdf`);
      toast.success('PDF downloaded');
    } catch { toast.error('Export failed'); } finally { setExporting(false); }
  }, [form, cardW, cardH, orientation]);

  const handleBulkExport = useCallback(async () => {
    if (selectedPersonIds.size === 0) {
      toast.error('Select at least one person');
      return;
    }
    const selected = persons.filter(p => selectedPersonIds.has(p.id));
    if (selected.length === 0) return;

    setExporting(true);
    try {
      const pdf = new jsPDF({ orientation: orientation === 'portrait' ? 'portrait' : 'landscape', unit: 'mm', format: [cardW, cardH] });

      for (let i = 0; i < selected.length; i++) {
        const p = selected[i];
        const tmpForm = {
          ...form,
          firstName: p.firstName,
          lastName: p.lastName,
          role: p.role,
          department: p.department,
          idNumber: p.idNumber,
          photoUrl: p.photoUrl,
        };

        if (i > 0) pdf.addPage();
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        document.body.appendChild(tempDiv);

        const text = `${tmpForm.firstName} ${tmpForm.lastName} | ID: ${tmpForm.idNumber} | ${schoolName}`;
        const tmpQr = await generateQR(text, 300);

        tempDiv.innerHTML = `<div style="width:${pw}px;height:${ph}px;overflow:hidden;border-radius:${mmPx(ROUNDED, PREVIEW_SCALE)}px;border:1px solid rgba(0,0,0,0.08);">
          ${/* simplified inline version of the card */ ''}
          <div style="width:100%;height:100%;background:${theme.bg};display:flex;align-items:center;justify-content:center;color:${theme.text};font-size:18px;font-weight:bold;">
            ${tmpForm.firstName} ${tmpForm.lastName}
          </div>
        </div>`;

        try {
          const dataUrl = await toPng(tempDiv.querySelector('div')!, { quality: 0.9, pixelRatio: 2, cacheBust: true });
          pdf.addImage(dataUrl, 'PNG', 0, 0, cardW, cardH);
        } finally {
          document.body.removeChild(tempDiv);
        }
      }

      pdf.save(`ID-Cards-Batch-${Date.now()}.pdf`);
      toast.success(`Downloaded ${selected.length} cards as PDF`);
    } catch { toast.error('Bulk export failed'); } finally { setExporting(false); }
  }, [selectedPersonIds, persons, form, schoolName, orientation, cardW, cardH, pw, ph, theme]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-50">
            <CreditCard className="size-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">ID Card Designer</h2>
            <p className="text-sm text-muted-foreground">Generate ID cards for students and staff</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} className="h-8 text-xs px-3">
            <RotateCcw className="size-3.5 mr-1.5" /> Reset
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setFullscreen(!fullscreen)} className="h-8 text-xs px-3">
            {fullscreen ? 'Compact' : 'Fullscreen'}
          </Button>
        </div>
      </div>

      <div className={cn('gap-6', fullscreen ? 'grid grid-cols-1 xl:grid-cols-[380px_1fr]' : 'grid grid-cols-1 lg:grid-cols-[380px_1fr]')}>
        <div className="space-y-4 bg-white rounded-xl border border-gray-200 p-5 shadow-sm lg:sticky lg:top-6 lg:max-h-[calc(100vh-140px)] lg:overflow-y-auto">
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="w-full grid grid-cols-4 h-9">
              <TabsTrigger value="info" className="text-xs font-medium">Info</TabsTrigger>
              <TabsTrigger value="design" className="text-xs font-medium">Design</TabsTrigger>
              <TabsTrigger value="back" className="text-xs font-medium">Back</TabsTrigger>
              <TabsTrigger value="export" className="text-xs font-medium">Export</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-4 mt-4">
              <Card className="border-gray-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Select Person</CardTitle>
                  <CardDescription className="text-xs">Choose a student or staff member to generate their ID card</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    {(['student', 'staff'] as CardType[]).map(t => (
                      <Button
                        key={t}
                        variant={cardType === t ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => { setCardType(t); setPersons([]); setSelectedPersonIds(new Set()); setForm(EMPTY_FORM); }}
                        className="flex-1 h-8 text-xs font-medium capitalize"
                      >
                        {t === 'staff' ? '👤 Staff' : '🎓 Student'}
                      </Button>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <div className="flex-1">
                      <select
                        value={classFilter}
                        onChange={e => setClassFilter(e.target.value)}
                        className="w-full h-8 text-xs border rounded px-2 bg-background"
                      >
                        <option value="">All {cardType === 'student' ? 'Classes' : 'Departments'}</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={fetchPersons} disabled={loadingPersons}>
                      {loadingPersons ? <Loader2 className="size-3 animate-spin mr-1" /> : <Users className="size-3 mr-1" />}
                      Load
                    </Button>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" />
                    <Input
                      placeholder="Search by name or ID..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="h-8 pl-7 text-xs"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch checked={bulkMode} onCheckedChange={setBulkMode} />
                    <Label className="text-xs">Bulk Selection Mode</Label>
                  </div>

                  <ScrollArea className="h-48 border rounded-md">
                    {loadingPersons ? (
                      <div className="flex items-center justify-center h-full"><Loader2 className="size-5 animate-spin" /></div>
                    ) : filteredPersons.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-xs text-muted-foreground p-4 text-center">
                        {persons.length === 0 ? 'Click "Load" to fetch records' : 'No matches found'}
                      </div>
                    ) : (
                      filteredPersons.map(p => (
                        <div
                          key={p.id}
                          className={`flex items-center gap-2 px-3 py-2 border-b text-xs hover:bg-muted/50 cursor-pointer transition-colors ${
                            form.id === p.id ? 'bg-primary/5' : ''
                          } ${bulkMode && selectedPersonIds.has(p.id) ? 'bg-primary/10' : ''}`}
                          onClick={() => bulkMode ? togglePersonSelection(p.id) : selectPerson(p)}
                        >
                          {bulkMode && <Checkbox checked={selectedPersonIds.has(p.id)} />}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{p.name}</div>
                            <div className="text-[10px] text-muted-foreground truncate">{p.idNumber} &middot; {p.department}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </ScrollArea>

                  {bulkMode && selectedPersonIds.size > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {selectedPersonIds.size} selected
                    </div>
                  )}
                </CardContent>
              </Card>

              {form.firstName && (
                <Card className="border-gray-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold">Personal Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-medium">First Name</Label>
                        <Input value={form.firstName} onChange={e => updateForm('firstName', e.target.value)} className="h-7 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-medium">Last Name</Label>
                        <Input value={form.lastName} onChange={e => updateForm('lastName', e.target.value)} className="h-7 text-xs" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-medium">ID Number</Label>
                        <Input value={form.idNumber} onChange={e => updateForm('idNumber', e.target.value)} className="h-7 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-medium">Blood Group</Label>
                        <select value={form.bloodGroup} onChange={e => updateForm('bloodGroup', e.target.value)} className="flex h-7 w-full rounded-md border border-input bg-background px-2 text-xs">
                          {BLOOD_GROUPS.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-medium">Phone</Label>
                        <Input value={form.phone} onChange={e => updateForm('phone', e.target.value)} className="h-7 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-medium">Dept/Class</Label>
                        <Input value={form.department} onChange={e => updateForm('department', e.target.value)} className="h-7 text-xs" />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Logo', value: logoFile, setter: setLogoFile },
                        { label: 'Photo', value: photoFile, setter: setPhotoFile },
                        { label: 'Signature', value: signatureFile, setter: setSignatureFile },
                      ].map(item => (
                        <div key={item.label} className="space-y-1">
                          <Label className="text-[10px] font-medium">{item.label}</Label>
                          <Button variant="outline" size="sm" className="h-7 w-full text-[10px] font-medium" onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.onchange = (e: any) => {
                              const reader = new FileReader();
                              reader.onload = () => item.setter(reader.result as string);
                              reader.readAsDataURL(e.target.files[0]);
                            };
                            input.click();
                          }}>{item.value ? '✓ Set' : 'Upload'}</Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="design" className="space-y-4 mt-4">
              <Card className="border-gray-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Design Options</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Orientation</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant={orientation === 'landscape' ? 'default' : 'outline'} size="sm" onClick={() => setOrientation('landscape')} className="h-8 text-xs font-medium">
                        📐 Landscape
                      </Button>
                      <Button variant={orientation === 'portrait' ? 'default' : 'outline'} size="sm" onClick={() => setOrientation('portrait')} className="h-8 text-xs font-medium">
                        📏 Portrait
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-xs font-medium">Color Themes</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {COLOR_THEMES.map(t => (
                        <button
                          key={t.name}
                          type="button"
                          title={t.name}
                          onClick={() => setTheme(t)}
                          className={cn(
                            'w-full aspect-[2/1] rounded-lg border-2 transition-all',
                            theme.name === t.name ? 'border-foreground ring-2 ring-foreground scale-105' : 'border-transparent hover:border-gray-300'
                          )}
                        >
                          <div className={`w-full h-full rounded-[6px] bg-gradient-to-r ${t.gradient}`} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-xs font-medium">Display Options</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'Photo', value: showPhoto, setter: setShowPhoto, icon: '📸' },
                        { label: 'Logo', value: showLogo, setter: setShowLogo, icon: '🏷️' },
                        { label: 'QR Code', value: showQR, setter: setShowQR, icon: '📱' },
                        { label: 'Watermark', value: showWatermark, setter: setShowWatermark, icon: '💧' },
                      ].map(item => (
                        <div key={item.label} className="flex items-center justify-between p-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{item.icon}</span>
                            <Label className="text-xs font-medium">{item.label}</Label>
                          </div>
                          <Switch checked={item.value} onCheckedChange={item.setter} />
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="back" className="mt-4">
              <Card className="border-gray-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Back Content</CardTitle>
                  <CardDescription className="text-xs">Terms and conditions for the back of the ID card</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Label className="text-xs font-medium">Back Text</Label>
                  <Textarea value={backText} onChange={e => setBackText(e.target.value)} className="min-h-[120px] text-xs resize-none" />
                  <p className="text-[10px] text-muted-foreground">Use {`{company}`} to insert school name automatically.</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="export" className="mt-4">
              <Card className="border-gray-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Export Options</CardTitle>
                  <CardDescription className="text-xs">Download your ID card in various formats</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button onClick={handleExportPNG} disabled={exporting || !form.firstName} className="w-full h-9 text-xs font-medium justify-start">
                    {exporting ? <Loader2 className="size-3.5 animate-spin mr-2" /> : <FileImage className="size-3.5 mr-2" />}
                    Download PNG
                  </Button>
                  <Button onClick={handleExportPDF} disabled={exporting || !form.firstName} className="w-full h-9 text-xs font-medium justify-start">
                    {exporting ? <Loader2 className="size-3.5 animate-spin mr-2" /> : <Download className="size-3.5 mr-2" />}
                    Download PDF
                  </Button>
                  <Separator />
                  <Button onClick={handleBulkExport} disabled={exporting || selectedPersonIds.size === 0} className="w-full h-9 text-xs font-medium justify-start" variant="secondary">
                    {exporting ? <Loader2 className="size-3.5 animate-spin mr-2" /> : <Users className="size-3.5 mr-2" />}
                    Bulk Export ({selectedPersonIds.size}) as PDF
                  </Button>
                  {selectedPersonIds.size > 0 && (
                    <p className="text-[10px] text-muted-foreground text-center">Selected {selectedPersonIds.size} card(s) for bulk export</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="flex flex-col items-center justify-start gap-6 w-full">
          <div className="flex gap-3 w-full justify-center flex-wrap">
            <Button variant={side === 'front' ? 'default' : 'outline'} size="sm" onClick={() => setSide('front')} className="h-8 text-xs px-4 font-medium">
              <Eye className="size-3.5 mr-1.5" /> Front View
            </Button>
            <Button variant={side === 'back' ? 'default' : 'outline'} size="sm" onClick={() => setSide('back')} className="h-8 text-xs px-4 font-medium">
              <EyeOff className="size-3.5 mr-1.5" /> Back View
            </Button>
            <Button onClick={handleExportPNG} disabled={exporting || !form.firstName} size="sm" variant="outline" className="h-8 text-xs px-4 font-medium">
              <Download className="size-3.5 mr-1.5" /> PNG
            </Button>
            <Button onClick={handleExportPDF} disabled={exporting || !form.firstName} size="sm" variant="outline" className="h-8 text-xs px-4 font-medium">
              <Printer className="size-3.5 mr-1.5" /> PDF
            </Button>
          </div>

          <div
            ref={cardRef}
            className="transition-all duration-300 shadow-2xl w-full max-w-[320px] sm:max-w-[380px] lg:max-w-none mx-auto"
            style={{
              width: pw, height: ph, borderRadius: mmPx(ROUNDED, PREVIEW_SCALE),
              overflow: 'hidden', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 4px 24px rgba(0,0,0,0.08)'
            }}
          >
            {renderCard()}
          </div>

          {!form.firstName && !bulkMode && (
            <p className="text-sm text-muted-foreground text-center">
              Select a person from the Info tab to preview their ID card
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
