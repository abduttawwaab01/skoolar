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
import { cn } from '@/lib/utils';
import QRCodeLib from 'qrcode';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import {
  Download, Printer, Palette, RotateCcw,
  Maximize2, Minimize2,
  CreditCard, FileImage, Loader2, Eye, EyeOff,
} from 'lucide-react';

const PREVIEW_SCALE = 4.2;
const EXPORT_SCALE = 8;
const ROUNDED = 3.5;

type CardType = 'staff' | 'student';
type CardSide = 'front' | 'back';
type FontSize = 'sm' | 'md' | 'lg';
type Orientation = 'landscape' | 'portrait';

interface FormData {
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
  issueDate: string;
  expiryDate: string;
  companyName: string;
  signatureName: string;
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
const FONT_SIZES: { value: FontSize; label: string }[] = [
  { value: 'sm', label: 'Small' },
  { value: 'md', label: 'Medium' },
  { value: 'lg', label: 'Large' },
];

const DEFAULT_FORM: FormData = {
  firstName: 'John',
  lastName: 'Doe',
  role: 'STUDENT',
  department: 'Grade 10 - Blue',
  idNumber: 'STU-2024-089',
  dateOfBirth: '2008-05-20',
  bloodGroup: 'O+',
  phone: '+234 810 000 0000',
  email: 'student@skoolar.org',
  address: '123 Excellence Way, Knowledge City',
  issueDate: new Date().toISOString().split('T')[0],
  expiryDate: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
  companyName: 'Skoolar International Academy',
  signatureName: 'Director of Studies',
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

function ColorThemePicker({ theme, onChange }: { theme: ColorTheme; onChange: (t: ColorTheme) => void }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium">Color Theme</Label>
      <div className="grid grid-cols-4 gap-1.5">
        {COLOR_THEMES.map(t => (
          <button
            key={t.name}
            type="button"
            title={t.name}
            onClick={() => onChange(t)}
            className={cn(
              'w-full aspect-[2/1] rounded-md border-2 transition-all',
              theme.name === t.name ? 'border-foreground ring-1 ring-foreground scale-105' : 'border-transparent hover:border-gray-300'
            )}
          >
            <div className={`w-full h-full rounded-[3px] bg-gradient-to-r ${t.gradient}`} />
          </button>
        ))}
      </div>
    </div>
  );
}

export function SuperAdminIDCard() {
  const { currentRole } = useAppStore();
  const [form, setForm] = useState<FormData>(DEFAULT_FORM);
  const [cardType, setCardType] = useState<CardType>('student');
  const [logoFile, setLogoFile] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<string | null>(null);
  const [signatureFile, setSignatureFile] = useState<string | null>(null);
  const [theme, setTheme] = useState<ColorTheme>(COLOR_THEMES[0]);
  const [side, setSide] = useState<CardSide>('front');
  const [fontSize, setFontSize] = useState<FontSize>('md');
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
  const [customColorMode, setCustomColorMode] = useState(false);
  const [customPrimary, setCustomPrimary] = useState('#059669');

  const cardRef = useRef<HTMLDivElement>(null);
  const activeTheme = customColorMode ? { ...theme, primary: customPrimary, headerBg: customPrimary } : theme;
  const cardW = orientation === 'landscape' ? 85.6 : 53.98;
  const cardH = orientation === 'landscape' ? 53.98 : 85.6;

  const updateForm = (key: keyof FormData, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  useEffect(() => {
    const text = `${form.firstName} ${form.lastName} | ID: ${form.idNumber} | ${form.companyName}`;
    generateQR(text, 300).then(setQrData);
  }, [form]);

  const handleReset = () => {
    setForm(DEFAULT_FORM);
    setLogoFile(null);
    setPhotoFile(null);
    setSignatureFile(null);
    toast.success('Form reset to defaults');
  };

  const exportPixelRatio = EXPORT_SCALE / PREVIEW_SCALE;

  async function captureCardElement(el: HTMLElement, ratio: number): Promise<string> {
    // Temporarily remove overflow:hidden so absolutely-positioned
    // children aren't clipped inside the foreignObject.
    // Also ensure a positioned ancestor so child `position:absolute`
    // resolves correctly.
    const origOverflow = el.style.overflow;
    const origPosition = el.style.position;
    el.style.overflow = 'visible';
    el.style.position = 'relative';

    await document.fonts.ready;
    const imgs = Array.from(el.querySelectorAll('img'));
    await Promise.all(imgs.map(img =>
      img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })
    ));
    await new Promise(r => requestAnimationFrame(r));
    if (el.offsetWidth === 0 || el.offsetHeight === 0) throw new Error('Element has zero dimensions');

    try {
      const { toPng } = await import('html-to-image');
      // Note: no cacheBust — same pattern as the working Report Card export.
      return toPng(el, {
        quality: 1, pixelRatio: ratio, backgroundColor: '#ffffff',
      });
    } finally {
      el.style.overflow = origOverflow;
      el.style.position = origPosition;
    }
  }

  const handleExportPNG = useCallback(async () => {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await captureCardElement(cardRef.current, exportPixelRatio);
      const link = document.createElement('a');
      link.download = `ID-${form.firstName}-${side}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('PNG downloaded');
    } catch { toast.error('Export failed'); } finally { setExporting(false); }
  }, [form, side, exportPixelRatio]);

  const handleExportPDF = useCallback(async () => {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await captureCardElement(cardRef.current, exportPixelRatio);
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: orientation === 'portrait' ? 'portrait' : 'landscape', unit: 'mm', format: [cardW, cardH] });
      doc.addImage(dataUrl, 'PNG', 0, 0, cardW, cardH, undefined, 'FAST');
      doc.save(`ID-${form.firstName}.pdf`);
      toast.success('PDF downloaded');
    } catch { toast.error('Export failed'); } finally { setExporting(false); }
  }, [form, cardW, cardH, orientation, exportPixelRatio]);

  const pw = mmPx(cardW, PREVIEW_SCALE);
  const ph = mmPx(cardH, PREVIEW_SCALE);

  const renderCard = () => {
    const s = PREVIEW_SCALE;
    const c = activeTheme;
    const isLand = orientation === 'landscape';
    const prim = c.primary;
    const primD = c.headerBg;
    const dark = c.text;
    const muted = c.textSecondary;

    if (side === 'back') {
      const parsedText = backText.replace(/\{company\}/g, form.companyName);
      return isLand ? (
        <div style={{ width: '100%', height: '100%', background: c.bg, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: `linear-gradient(${prim}05 1px, transparent 1px), linear-gradient(90deg, ${prim}05 1px, transparent 1px)`, backgroundSize: mmPx(5, s) + 'px ' + mmPx(5, s) + 'px' }} />
          <div style={{ height: mmPx(12, s), background: prim, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: mmPx(2.2, s), textTransform: 'uppercase', letterSpacing: '1px', zIndex: 1, position: 'relative' }}>Terms of Use</div>
          <div style={{ padding: mmPx(4, s), display: 'flex', gap: mmPx(5, s), position: 'relative', zIndex: 1 }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: prim, fontWeight: 900, fontSize: mmPx(1.6, s), textTransform: 'uppercase', marginBottom: mmPx(1.5, s), borderBottom: `0.5px solid ${prim}20` }}>Instructions</div>
              <div style={{ color: dark, fontSize: mmPx(1.4, s), lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{parsedText}</div>
            </div>
            <div style={{ width: mmPx(30, s) }}>
              <div style={{ color: prim, fontWeight: 900, fontSize: mmPx(1.6, s), textTransform: 'uppercase', marginBottom: mmPx(1.5, s), borderBottom: `0.5px solid ${prim}20` }}>Contact</div>
              <div style={{ color: dark, fontSize: mmPx(1.4, s), fontWeight: 600 }}>{form.phone}</div>
              <div style={{ color: dark, fontSize: mmPx(1.3, s), marginTop: mmPx(1, s) }}>{form.address}</div>
            </div>
          </div>
          <div style={{ position: 'absolute', bottom: mmPx(4, s), right: mmPx(6, s), textAlign: 'center', width: mmPx(35, s) }}>
            {signatureFile && <img src={signatureFile} style={{ height: mmPx(6, s), objectFit: 'contain', marginBottom: mmPx(1, s) }} />}
            <div style={{ width: '100%', height: '0.2px', background: dark, opacity: 0.3 }} />
            <div style={{ fontSize: mmPx(1.2, s), fontWeight: 800, color: muted, textTransform: 'uppercase', marginTop: mmPx(1, s) }}>Authorized Signatory</div>
          </div>
        </div>
      ) : (
        <div style={{ width: '100%', height: '100%', background: c.bg, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: `linear-gradient(${prim}05 1px, transparent 1px), linear-gradient(90deg, ${prim}05 1px, transparent 1px)`, backgroundSize: mmPx(5, s) + 'px ' + mmPx(5, s) + 'px' }} />
          <div style={{ height: mmPx(20, s), background: `linear-gradient(135deg, ${prim}, ${prim}dd)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', padding: mmPx(5, s) }}>
            <div style={{ fontWeight: 900, fontSize: mmPx(2.2, s), textTransform: 'uppercase', letterSpacing: '1.5px' }}>Official Identity</div>
            <div style={{ fontSize: mmPx(1.6, s), opacity: 0.8, marginTop: mmPx(1, s) }}>{form.companyName}</div>
          </div>
          <div style={{ padding: mmPx(6, s), zIndex: 1, position: 'relative' }}>
            <div style={{ color: prim, fontWeight: 900, fontSize: mmPx(1.6, s), textTransform: 'uppercase', marginBottom: mmPx(2, s), borderLeft: `1mm solid ${prim}`, paddingLeft: mmPx(2, s) }}>Terms & Conditions</div>
            <div style={{ color: dark, fontSize: mmPx(1.5, s), lineHeight: 1.6, marginBottom: mmPx(5, s), whiteSpace: 'pre-wrap' }}>{parsedText}</div>
            <div style={{ marginTop: mmPx(10, s), textAlign: 'center' }}>
              {signatureFile && <img src={signatureFile} style={{ height: mmPx(8, s), objectFit: 'contain', marginBottom: mmPx(2, s) }} />}
              <div style={{ width: mmPx(30, s), height: '0.2px', background: dark, opacity: 0.3, margin: '0 auto' }} />
              <div style={{ fontSize: mmPx(1.4, s), fontWeight: 800, color: muted, textTransform: 'uppercase', marginTop: mmPx(1.5, s) }}>Authorized Signatory</div>
            </div>
          </div>
        </div>
      );
    }

    if (isLand) {
      return (
        <div style={{ width: '100%', height: '100%', background: c.bg, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: `radial-gradient(${prim}08 1px, transparent 1px)`, backgroundSize: mmPx(4, s) + 'px ' + mmPx(4, s) + 'px' }} />
          <div style={{ position: 'absolute', top: 0, left: 0, width: mmPx(4, s), bottom: 0, background: `linear-gradient(180deg, ${primD}, ${prim})` }} />
          <div style={{ position: 'absolute', top: 0, left: mmPx(4, s), right: 0, height: mmPx(16, s), display: 'flex', alignItems: 'center', padding: `0 ${mmPx(4, s)}px` }}>
            {showLogo && logoFile && <img src={logoFile} style={{ width: mmPx(10, s), height: mmPx(10, s), borderRadius: mmPx(2, s), objectFit: 'contain', marginRight: mmPx(3, s) }} />}
            <div style={{ flex: 1 }}>
              <div style={{ color: dark, fontWeight: 900, fontSize: mmPx(3.5, s), textTransform: 'uppercase' }}>{form.companyName}</div>
              <div style={{ color: muted, fontSize: mmPx(1.6, s), fontStyle: 'italic' }}>E-Learning & Management System</div>
            </div>
          </div>
          <div style={{ position: 'absolute', top: mmPx(16, s), left: mmPx(4, s), right: 0, bottom: mmPx(6, s), display: 'flex', alignItems: 'center', padding: `0 ${mmPx(4, s)}px`, gap: mmPx(5, s) }}>
            {showPhoto && (
              <div style={{ width: mmPx(24, s), height: mmPx(28, s), borderRadius: mmPx(3, s), overflow: 'hidden', border: `1.5px solid ${prim}20`, background: `${prim}05`, boxShadow: '0 2mm 4mm rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {photoFile ? <img src={photoFile} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: mmPx(8, s), fontWeight: 900, color: prim, opacity: 0.2 }}>{form.firstName[0]}{form.lastName[0]}</span>}
              </div>
            )}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: mmPx(1.5, s) }}>
              <div style={{ color: dark, fontWeight: 900, fontSize: mmPx(4.8, s) }}>{form.firstName} {form.lastName}</div>
              <div style={{ background: prim, color: 'white', padding: '0.6mm 2.5mm', borderRadius: '1mm', fontSize: mmPx(1.8, s), fontWeight: 800, display: 'inline-block', alignSelf: 'flex-start', textTransform: 'uppercase' }}>{cardType}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: mmPx(3, s), rowGap: mmPx(0.8, s), marginTop: mmPx(1.5, s) }}>
                <span style={{ color: muted, fontSize: mmPx(1.5, s), fontWeight: 800, textTransform: 'uppercase' }}>ID No</span>
                <span style={{ color: dark, fontSize: mmPx(1.8, s), fontWeight: 600 }}>{form.idNumber}</span>
                <span style={{ color: muted, fontSize: mmPx(1.5, s), fontWeight: 800, textTransform: 'uppercase' }}>Dept</span>
                <span style={{ color: dark, fontSize: mmPx(1.8, s), fontWeight: 600 }}>{form.department}</span>
              </div>
            </div>
            {showQR && qrData && <div style={{ width: mmPx(14, s), height: mmPx(14, s) }}><img src={qrData} style={{ width: '100%', height: '100%', borderRadius: mmPx(1, s) }} /></div>}
          </div>
          <div style={{ position: 'absolute', bottom: 0, left: mmPx(4, s), right: 0, height: mmPx(6, s), borderTop: `0.5px solid ${prim}10`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `0 ${mmPx(4, s)}px` }}>
            <div style={{ color: muted, fontSize: mmPx(1.6, s), fontWeight: 700 }}>OFFICIAL IDENTITY CARD</div>
            <div style={{ background: '#fbbf24', color: 'black', padding: '0.5mm 1.5mm', borderRadius: '1mm', fontSize: mmPx(1.6, s), fontWeight: 900 }}>BLOOD: {form.bloodGroup}</div>
          </div>
          {showWatermark && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-25deg)', fontSize: mmPx(12, s), fontWeight: 900, color: prim, opacity: 0.03, whiteSpace: 'nowrap', textTransform: 'uppercase' }}>{form.companyName}</div>}
        </div>
      );
    } else {
      return (
        <div style={{ width: '100%', height: '100%', background: c.bg, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: `radial-gradient(${prim}08 1px, transparent 1px)`, backgroundSize: mmPx(5, s) + 'px ' + mmPx(5, s) + 'px' }} />
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: mmPx(32, s), background: `linear-gradient(135deg, ${primD}, ${prim})`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: mmPx(5, s), color: 'white' }}>
            {showLogo && logoFile && <div style={{ width: mmPx(12, s), height: mmPx(12, s), borderRadius: mmPx(2.5, s), background: 'white', padding: mmPx(1.5, s), marginBottom: mmPx(2.5, s) }}><img src={logoFile} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /></div>}
            <div style={{ fontWeight: 900, fontSize: mmPx(2.8, s), textTransform: 'uppercase', textAlign: 'center' }}>{form.companyName}</div>
          </div>
          <div style={{ position: 'absolute', top: mmPx(32, s), left: 0, right: 0, bottom: mmPx(10, s), display: 'flex', flexDirection: 'column', alignItems: 'center', padding: `0 ${mmPx(5, s)}px` }}>
            <div style={{ width: mmPx(26, s), height: mmPx(30, s), borderRadius: mmPx(4, s), overflow: 'hidden', border: `${mmPx(2, s)}px solid white`, background: 'white', boxShadow: '0 2mm 5mm rgba(0,0,0,0.1)', marginTop: mmPx(-15, s), marginBottom: mmPx(3, s) }}>
              {photoFile ? <img src={photoFile} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: mmPx(10, s), fontWeight: 900, color: prim, opacity: 0.1, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>{form.firstName[0]}</span>}
            </div>
            <div style={{ color: dark, fontWeight: 900, fontSize: mmPx(4.5, s), textAlign: 'center' }}>{form.firstName} {form.lastName}</div>
            <div style={{ background: `${prim}15`, color: prim, padding: '0.8mm 3mm', borderRadius: '1.5mm', fontSize: mmPx(1.8, s), fontWeight: 800, textTransform: 'uppercase', marginTop: mmPx(1.5, s) }}>{cardType}</div>
            <div style={{ width: '100%', marginTop: mmPx(4, s), display: 'flex', flexDirection: 'column', gap: mmPx(1.5, s) }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `0.2px solid ${prim}10`, paddingBottom: mmPx(0.8, s) }}><span style={{ color: muted, fontSize: mmPx(1.5, s), fontWeight: 800 }}>ID NO</span><span style={{ color: dark, fontSize: mmPx(1.7, s), fontWeight: 700 }}>{form.idNumber}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `0.2px solid ${prim}10`, paddingBottom: mmPx(0.8, s) }}><span style={{ color: muted, fontSize: mmPx(1.5, s), fontWeight: 800 }}>DEPT</span><span style={{ color: dark, fontSize: mmPx(1.7, s), fontWeight: 700 }}>{form.department}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `0.2px solid ${prim}10`, paddingBottom: mmPx(0.8, s) }}><span style={{ color: muted, fontSize: mmPx(1.5, s), fontWeight: 800 }}>BLOOD</span><span style={{ color: dark, fontSize: mmPx(1.7, s), fontWeight: 700 }}>{form.bloodGroup}</span></div>
            </div>
          </div>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: mmPx(12, s), display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `0 ${mmPx(5, s)}px`, background: `${prim}05` }}>
            <span style={{ color: muted, fontSize: mmPx(1.4, s), fontWeight: 700, opacity: 0.6 }}>OFFICIAL ID</span>
            {showQR && qrData && <div style={{ width: mmPx(10, s), height: mmPx(10, s) }}><img src={qrData} style={{ width: '100%', height: '100%', borderRadius: '0.5mm' }} /></div>}
          </div>
        </div>
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-50">
            <CreditCard className="size-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">ID Card Designer</h2>
            <p className="text-sm text-muted-foreground">Create and customize professional ID cards</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs px-3 py-1">
            <Palette className="size-3 mr-1.5" /> Professional Suite
          </Badge>
          <Button variant="outline" size="sm" onClick={handleReset} className="h-8 text-xs px-3">
            <RotateCcw className="size-3.5 mr-1.5" /> Reset
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setFullscreen(!fullscreen)} className="h-8 text-xs px-3">
            {fullscreen ? <Minimize2 className="size-3.5 mr-1.5" /> : <Maximize2 className="size-3.5 mr-1.5" />} {fullscreen ? 'Compact' : 'Fullscreen'}
          </Button>
        </div>
      </div>

      <div className={cn('gap-6', fullscreen ? 'grid grid-cols-1 xl:grid-cols-[380px_1fr]' : 'grid grid-cols-1 lg:grid-cols-[380px_1fr]')}>
        <div className="space-y-4 bg-white rounded-xl border border-gray-200 p-5 shadow-sm lg:sticky lg:top-6 lg:max-h-[calc(100vh-140px)] lg:overflow-y-auto">
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Card Configuration</h3>
            <p className="text-sm text-muted-foreground">Configure your ID card details and design</p>
          </div>
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
                  <CardTitle className="text-sm font-semibold">Personal Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Card Type</Label>
                    <div className="flex gap-2">
                      {(['staff', 'student'] as CardType[]).map(t => (
                        <Button key={t} variant={cardType === t ? 'default' : 'outline'} size="sm" onClick={() => setCardType(t)} className="flex-1 h-8 text-xs font-medium">
                          {t === 'staff' ? '👤 Staff' : '🎓 Student'}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">First Name</Label>
                      <Input value={form.firstName} onChange={e => updateForm('firstName', e.target.value)} className="h-8 text-xs" placeholder="John" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Last Name</Label>
                      <Input value={form.lastName} onChange={e => updateForm('lastName', e.target.value)} className="h-8 text-xs" placeholder="Doe" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Role/Position</Label>
                      <Input value={form.role} onChange={e => updateForm('role', e.target.value)} className="h-8 text-xs" placeholder="Student" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Department/Class</Label>
                      <Input value={form.department} onChange={e => updateForm('department', e.target.value)} className="h-8 text-xs" placeholder="Grade 10 - Blue" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">ID Number</Label>
                      <Input value={form.idNumber} onChange={e => updateForm('idNumber', e.target.value)} className="h-8 text-xs" placeholder="STU-2024-089" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Blood Group</Label>
                      <select value={form.bloodGroup} onChange={e => updateForm('bloodGroup', e.target.value)} className="flex h-8 w-full rounded-md border border-input bg-background px-3 text-xs">
                        {BLOOD_GROUPS.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">School Name</Label>
                    <Input value={form.companyName} onChange={e => updateForm('companyName', e.target.value)} className="h-8 text-xs" placeholder="Skoolar International Academy" />
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    {[
                      { label: 'Logo', value: logoFile, setter: setLogoFile },
                      { label: 'Photo', value: photoFile, setter: setPhotoFile },
                      { label: 'Signature', value: signatureFile, setter: setSignatureFile },
                    ].map(item => (
                      <div key={item.label} className="space-y-1.5">
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
                  <Textarea value={backText} onChange={e => setBackText(e.target.value)} className="min-h-[120px] text-xs resize-none" placeholder="Enter terms and conditions here..." />
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
                  <Button onClick={handleExportPNG} disabled={exporting} className="w-full h-9 text-xs font-medium justify-start">
                    {exporting ? <Loader2 className="size-3.5 animate-spin mr-2" /> : <FileImage className="size-3.5 mr-2" />}
                    Download PNG
                  </Button>
                  <Button onClick={handleExportPDF} disabled={exporting} className="w-full h-9 text-xs font-medium justify-start">
                    {exporting ? <Loader2 className="size-3.5 animate-spin mr-2" /> : <Download className="size-3.5 mr-2" />}
                    Download PDF
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="flex flex-col items-center justify-start gap-6 w-full">
          <div className="flex gap-3 w-full justify-center">
            <Button variant={side === 'front' ? 'default' : 'outline'} size="sm" onClick={() => setSide('front')} className="h-8 text-xs px-4 font-medium">
              <Eye className="size-3.5 mr-1.5" /> Front View
            </Button>
            <Button variant={side === 'back' ? 'default' : 'outline'} size="sm" onClick={() => setSide('back')} className="h-8 text-xs px-4 font-medium">
              <EyeOff className="size-3.5 mr-1.5" /> Back View
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

          <div className="flex gap-4 w-full justify-center">
            <Button onClick={handleExportPNG} disabled={exporting} size="sm" variant="outline" className="h-9 text-xs px-5 font-medium">
              <Download className="size-3.5 mr-1.5" /> Download PNG
            </Button>
            <Button onClick={handleExportPDF} disabled={exporting} size="sm" variant="outline" className="h-9 text-xs px-5 font-medium">
              <Printer className="size-3.5 mr-1.5" /> Print / PDF
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
