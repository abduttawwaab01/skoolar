'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { toPng, toBlob } from 'html-to-image';
import QRCodeLib from 'qrcode';
import { jsPDF } from 'jspdf';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import {
  Download, Printer, User, Upload, Palette, RotateCcw,
  Camera, Building2, Hash, ChevronRight, Maximize2, Minimize2,
  Type, Image, Check, X, Plus,
  CreditCard, FileImage, Loader2, Eye, EyeOff, QrCode,
  GraduationCap,
} from 'lucide-react';

// ÔöÇÔöÇÔöÇ Constants ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
const CARD_WIDTH = 85.6;   // mm (CR80)
const CARD_HEIGHT = 53.98; // mm (CR80)
const PREVIEW_SCALE = 4.2; // px per mm => ~360x227px preview
const EXPORT_SCALE = 8;    // px per mm => ~685x432px export (2x print quality)
const ROUNDED = 3.5;       // mm corner radius

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
  { name: 'Emerald', primary: '#059669', secondary: '#34d399', accent: '#fbbf24', text: '#064e3b', textSecondary: '#6b7280', headerBg: '#059669', bg: '#ffffff', gradient: 'from-emerald-600 to-emerald-500' },
  { name: 'Royal Blue', primary: '#1d4ed8', secondary: '#60a5fa', accent: '#f59e0b', text: '#1e3a5f', textSecondary: '#6b7280', headerBg: '#1d4ed8', bg: '#ffffff', gradient: 'from-blue-600 to-blue-500' },
  { name: 'Crimson', primary: '#dc2626', secondary: '#f87171', accent: '#fcd34d', text: '#7f1d1d', textSecondary: '#6b7280', headerBg: '#dc2626', bg: '#ffffff', gradient: 'from-red-600 to-red-500' },
  { name: 'Purple', primary: '#7c3aed', secondary: '#a78bfa', accent: '#34d399', text: '#4c1d95', textSecondary: '#6b7280', headerBg: '#7c3aed', bg: '#ffffff', gradient: 'from-purple-600 to-purple-500' },
  { name: 'Teal', primary: '#0d9488', secondary: '#5eead4', accent: '#fbbf24', text: '#134e4a', textSecondary: '#6b7280', headerBg: '#0d9488', bg: '#ffffff', gradient: 'from-teal-600 to-teal-500' },
  { name: 'Amber', primary: '#d97706', secondary: '#fbbf24', accent: '#3b82f6', text: '#78350f', textSecondary: '#6b7280', headerBg: '#d97706', bg: '#ffffff', gradient: 'from-amber-600 to-amber-500' },
  { name: 'Rose', primary: '#e11d48', secondary: '#fb7185', accent: '#a78bfa', text: '#881337', textSecondary: '#6b7280', headerBg: '#e11d48', bg: '#ffffff', gradient: 'from-rose-600 to-rose-500' },
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
  role: 'Software Engineer',
  department: 'Engineering',
  idNumber: 'EMP-2024-001',
  dateOfBirth: '1990-01-15',
  bloodGroup: 'O+',
  phone: '+234 800 000 0000',
  email: 'john.doe@company.com',
  address: '123 Main Street, Lagos',
  issueDate: new Date().toISOString().split('T')[0],
  expiryDate: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
  companyName: 'Skoolar',
  signatureName: 'John Doe',
};

// ÔöÇÔöÇÔöÇ Helper: format date ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
function fmtDate(d: string): string {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

// ÔöÇÔöÇÔöÇ Helper: mm to px ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
function mmPx(mm: number, scale: number): number { return mm * scale; }

// ÔöÇÔöÇÔöÇ Helper: generate QR as data URL ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
async function generateQR(text: string, size: number): Promise<string> {
  if (!text) return '';
  try {
    return await QRCodeLib.toDataURL(text, {
      width: size, margin: 1, color: { dark: '#1a1a2e', light: '#ffffff' },
    });
  } catch { return ''; }
}

// ÔöÇÔöÇÔöÇ Sub-Component: Color Theme Picker ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
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

// ÔöÇÔöÇÔöÇ Main Component ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
export function SuperAdminIDCard() {
  const { currentRole } = useAppStore();
  const isSuperAdmin = currentRole === 'SUPER_ADMIN';

  // ── Form ──
  const [form, setForm] = useState<FormData>(DEFAULT_FORM);
  const [cardType, setCardType] = useState<CardType>('staff');

  // ── Files ──
  const [logoFile, setLogoFile] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<string | null>(null);
  const [signatureFile, setSignatureFile] = useState<string | null>(null);

  // ── Design ──
  const [theme, setTheme] = useState<ColorTheme>(COLOR_THEMES[0]);
  const [side, setSide] = useState<CardSide>('front');
  const [fontSize, setFontSize] = useState<FontSize>('md');
  const [orientation, setOrientation] = useState<Orientation>('landscape');
  const [showPhoto, setShowPhoto] = useState(true);
  const [showLogo, setShowLogo] = useState(true);
  const [showQR, setShowQR] = useState(true);
  const [showBarcode, setShowBarcode] = useState(true);
  const [showSignature, setShowSignature] = useState(false);
  const [showWatermark, setShowWatermark] = useState(true);

  // ÔöÇÔöÇ Back text ÔöÇÔöÇ
  const [backText, setBackText] = useState(
    'This ID card remains the property of {company}.\nIf found, please return to the nearest office.\n\nTerms:\n1. Always carry this ID while on premises\n2. Do not share or lend your ID card\n3. Report lost cards immediately\n4. Return card upon departure'
  );

  // ÔöÇÔöÇ QR ÔöÇÔöÇ
  const [qrData, setQrData] = useState<string>('');
  const [qrSelection, setQrSelection] = useState<string[]>([
    'idNumber', 'firstName', 'lastName', 'role', 'companyName',
  ]);

  // ÔöÇÔöÇ State ÔöÇÔöÇ
  const [fullscreen, setFullscreen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [customColorMode, setCustomColorMode] = useState(false);
  const [customPrimary, setCustomPrimary] = useState('#059669');
  const [customSecondary, setCustomSecondary] = useState('#34d399');
  const [customAccent, setCustomAccent] = useState('#fbbf24');

  const cardRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // ÔöÇÔöÇ Derived theme ÔöÇÔöÇ
  const activeTheme = customColorMode
    ? { ...COLOR_THEMES[0], primary: customPrimary, secondary: customSecondary, accent: customAccent }
    : theme;
  const cardW = orientation === 'landscape' ? 85.6 : 53.98;
  const cardH = orientation === 'landscape' ? 53.98 : 85.6;

  // ÔöÇÔöÇ Update form helper ÔöÇÔöÇ
  const updateForm = (key: keyof FormData, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  // ÔöÇÔöÇ File uploads ÔöÇÔöÇ
  const handleFile = (setter: (v: string | null) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setter(reader.result as string);
    reader.readAsDataURL(file);
  };

  // ÔöÇÔöÇ Generate QR on change ÔöÇÔöÇ
  useEffect(() => {
    const parts: string[] = [];
    if (qrSelection.includes('firstName')) parts.push(`Name: ${form.firstName} ${form.lastName}`);
    if (qrSelection.includes('lastName')) {}
    if (qrSelection.includes('idNumber')) parts.push(`ID: ${form.idNumber}`);
    if (qrSelection.includes('role')) parts.push(`Role: ${form.role}`);
    if (qrSelection.includes('department')) parts.push(`Dept: ${form.department}`);
    if (qrSelection.includes('companyName')) parts.push(`Company: ${form.companyName}`);
    if (qrSelection.includes('phone')) parts.push(`Phone: ${form.phone}`);
    if (qrSelection.includes('email')) parts.push(`Email: ${form.email}`);
    if (qrSelection.includes('bloodGroup')) parts.push(`Blood: ${form.bloodGroup}`);

    const text = parts.join('\n') || `${form.firstName} ${form.lastName} | ${form.idNumber}`;
    generateQR(text, 300).then(setQrData);
  }, [form, qrSelection]);

  // ÔöÇÔöÇ Reset ÔöÇÔöÇ
  const handleReset = () => {
    setForm(DEFAULT_FORM);
    setLogoFile(null);
    setPhotoFile(null);
    setSignatureFile(null);
    setTheme(COLOR_THEMES[0]);
    setCustomColorMode(false);
    setFontSize('md');
    setOrientation('landscape');
    setShowPhoto(true);
    setShowLogo(true);
    setShowQR(true);
    setShowBarcode(true);
    setShowSignature(false);
    setShowWatermark(true);
    toast.success('Form reset to defaults');
  };

  // ÔöÇÔöÇ Export as PNG ÔöÇÔöÇ
  const handleExportPNG = useCallback(async () => {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      const node = cardRef.current;
      const scale = EXPORT_SCALE / PREVIEW_SCALE;
      const dataUrl = await toPng(node, { quality: 1, pixelRatio: scale, cacheBust: true });
      const link = document.createElement('a');
      link.download = `${form.companyName}-ID-${form.firstName}-${form.lastName}-${side.toUpperCase()}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('PNG downloaded');
    } catch (err) {
      console.error(err);
      toast.error('Failed to export PNG');
    } finally {
      setExporting(false);
    }
  }, [form, side]);

  // ÔöÇÔöÇ Export as PDF ÔöÇÔöÇ
  const handleExportPDF = useCallback(async () => {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      const node = cardRef.current;
      const scale = EXPORT_SCALE / PREVIEW_SCALE;
      const dataUrl = await toPng(node, { quality: 1, pixelRatio: scale, cacheBust: true });

      const pdf = new jsPDF({ orientation: orientation === 'portrait' ? 'portrait' : 'landscape', unit: 'mm', format: [cardW, cardH] });
      pdf.addImage(dataUrl, 'PNG', 0, 0, cardW, cardH);
      pdf.save(`${form.companyName}-ID-${form.firstName}-${form.lastName}-${side.toUpperCase()}.pdf`);
      toast.success('PDF downloaded');
    } catch (err) {
      console.error(err);
      toast.error('Failed to export PDF');
    } finally {
      setExporting(false);
    }
  }, [form, side, cardW, cardH, orientation]);

  // ÔöÇÔöÇ Handle Print ÔöÇÔöÇ
  const handlePrint = useCallback(async () => {
    if (!cardRef.current) return;
    try {
      const node = cardRef.current;
      const scale = EXPORT_SCALE / PREVIEW_SCALE;
      const dataUrl = await toPng(node, { quality: 1, pixelRatio: scale, cacheBust: true });
      const win = window.open('', '_blank');
      if (!win) { toast.error('Popup blocked'); return; }
      win.document.write(`<img src="${dataUrl}" style="max-width:100%;" onload="window.print();window.close();" />`);
    } catch {
      toast.error('Failed to print');
    }
  }, [form, side]);

  // ÔöÇÔöÇ Preview card rendered in DOM ÔöÇÔöÇ
  const pw = mmPx(cardW, PREVIEW_SCALE);
  const ph = mmPx(cardH, PREVIEW_SCALE);
  const corner = mmPx(ROUNDED, PREVIEW_SCALE);

  // ÔöÇÔöÇ QR selection toggles ÔöÇÔöÇ
  const qrOptions = [
    { key: 'firstName', label: 'Name' },
    { key: 'idNumber', label: 'ID Number' },
    { key: 'role', label: 'Role' },
    { key: 'department', label: 'Department' },
    { key: 'companyName', label: 'Company' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
    { key: 'bloodGroup', label: 'Blood Group' },
  ];

  const toggleQrSelection = (key: string) => {
    setQrSelection(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // ÔöÇÔöÇ Render card preview ÔöÇÔöÇ
  const renderCard = () => {
    const cardScale = PREVIEW_SCALE;
    const w = mmPx(cardW, cardScale);
    const h = mmPx(cardH, cardScale);
    const r = mmPx(ROUNDED, cardScale);

    const c = activeTheme;

    const parsedBackText = backText
      .replace(/\{company\}/g, form.companyName)
      .replace(/\{name\}/g, `${form.firstName} ${form.lastName}`)
      .replace(/\{id\}/g, form.idNumber);

    return (
      <div
        ref={cardRef}
        className="relative overflow-hidden"
        style={{
          width: `${w}px`,
          height: `${h}px`,
          borderRadius: `${r}px`,
          fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
          WebkitFontSmoothing: 'antialiased',
          textRendering: 'geometricPrecision',
        }}
      >
        {side === 'front' ? renderFront(w, h, r, c, cardScale) : renderBack(w, h, r, c, cardScale, parsedBackText)}
      </div>
    );
  };

  // ÔöÇÔöÇ Front Side ÔöÇÔöÇ
  function renderFront(w: number, h: number, _r: number, c: ColorTheme, s: number) {
    const isLandscape = orientation === 'landscape';

    if (isLandscape) {
      return renderLandscapeFront(w, h, c, s);
    }
    return renderPortraitFront(w, h, c, s);
  }

  function renderLandscapeFront(w: number, h: number, c: ColorTheme, s: number) {
    const padX = mmPx(2.8, s);
    const photoSize = mmPx(11, s);
    const prim = c.primary;
    const primD = c.headerBg;
    const accent = c.accent;
    const dark = c.text;
    const muted = c.textSecondary;
    const hdrTxt = '#ffffff';

    return (
      <div style={{ width: '100%', height: '100%', background: c.bg, position: 'relative', overflow: 'hidden' }}>
        {/* Top accent line */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: mmPx(2.8, s), background: `linear-gradient(90deg, ${primD}, ${prim})`, zIndex: 2 }} />

        {/* Header */}
        <div style={{
          position: 'absolute', top: mmPx(2.8, s), left: 0, right: 0, height: mmPx(10, s),
          background: `linear-gradient(135deg, ${primD}, ${prim})`,
          display: 'flex', alignItems: 'center', padding: `0 ${padX}px`, zIndex: 1,
        }}>
          {showLogo && logoFile && (
            <img src={logoFile} alt="Logo" style={{ width: mmPx(6, s), height: mmPx(6, s), borderRadius: mmPx(1, s), objectFit: 'contain', background: 'rgba(255,255,255,0.15)', marginRight: mmPx(2, s), flexShrink: 0 }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: hdrTxt, fontWeight: 700, fontSize: mmPx(2.6, s), lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {form.companyName || 'COMPANY NAME'}
            </div>
            <div style={{ color: hdrTxt, fontSize: mmPx(1.3, s), opacity: 0.7, fontStyle: 'italic', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {cardType === 'staff' ? 'STAFF ID CARD' : 'STUDENT ID CARD'}
            </div>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.18)', color: hdrTxt, fontSize: mmPx(1.6, s), fontWeight: 700,
            padding: `${mmPx(0.8, s)}px ${mmPx(2, s)}px`, borderRadius: mmPx(2, s), letterSpacing: '0.5px',
            whiteSpace: 'nowrap', flexShrink: 0, backdropFilter: 'blur(2px)',
          }}>
            {cardType === 'staff' ? 'STAFF' : 'STUDENT'}
          </div>
        </div>

        {/* Body */}
        <div style={{
          position: 'absolute', top: mmPx(14, s), left: 0, right: 0, bottom: mmPx(4.5, s),
          display: 'flex', alignItems: 'center', padding: `0 ${padX}px`, gap: mmPx(2.8, s),
        }}>
          {/* Photo section */}
          {showPhoto && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: mmPx(0.8, s), flexShrink: 0 }}>
              <div style={{
                width: photoSize, height: photoSize, borderRadius: '50%',
                background: `${prim}08`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', border: `2px solid ${prim}30`,
                boxShadow: `0 ${mmPx(1, s)}px ${mmPx(2, s)}px ${prim}15`,
              }}>
                {photoFile ? (
                  <img src={photoFile} alt="Photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: mmPx(4.5, s), fontWeight: 700, color: prim, opacity: 0.35 }}>
                    {(form.firstName[0] || '') + (form.lastName[0] || '') || '?'}
                  </span>
                )}
              </div>
              {form.bloodGroup && (
                <div style={{
                  background: accent, color: '#000', fontSize: mmPx(1.4, s), fontWeight: 700,
                  padding: `${mmPx(0.3, s)}px ${mmPx(1.5, s)}px`, borderRadius: mmPx(1, s),
                  lineHeight: 1.3,
                }}>
                  {form.bloodGroup}
                </div>
              )}
            </div>
          )}

          {/* Info section */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: mmPx(0.6, s) }}>
            <div style={{ color: dark, fontWeight: 800, fontSize: mmPx(3.2, s), lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {form.firstName} {form.lastName}
            </div>
            <div style={{
              background: `${prim}12`, color: prim, fontWeight: 700, fontSize: mmPx(1.6, s),
              padding: `${mmPx(0.5, s)}px ${mmPx(2, s)}px`, borderRadius: mmPx(2, s),
              display: 'inline-block', alignSelf: 'flex-start', lineHeight: 1.3,
            }}>
              {form.role || 'N/A'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: mmPx(2, s), rowGap: mmPx(0.5, s), marginTop: mmPx(0.8, s) }}>
              <span style={{ color: muted, fontSize: mmPx(1.4, s), fontWeight: 500, lineHeight: 1.2 }}>ID No</span>
              <span style={{ color: dark, fontSize: mmPx(1.5, s), fontWeight: 600, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{form.idNumber}</span>
              <span style={{ color: muted, fontSize: mmPx(1.4, s), fontWeight: 500, lineHeight: 1.2 }}>Dept</span>
              <span style={{ color: dark, fontSize: mmPx(1.5, s), fontWeight: 600, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{form.department || 'N/A'}</span>
              {form.phone && (<><span style={{ color: muted, fontSize: mmPx(1.4, s), fontWeight: 500, lineHeight: 1.2 }}>Phone</span><span style={{ color: dark, fontSize: mmPx(1.5, s), fontWeight: 600, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{form.phone}</span></>)}
              <span style={{ color: muted, fontSize: mmPx(1.4, s), fontWeight: 500, lineHeight: 1.2 }}>Issued</span>
              <span style={{ color: dark, fontSize: mmPx(1.5, s), fontWeight: 600, lineHeight: 1.2 }}>{fmtDate(form.issueDate)}</span>
              <span style={{ color: muted, fontSize: mmPx(1.4, s), fontWeight: 500, lineHeight: 1.2 }}>Expires</span>
              <span style={{ color: accent, fontSize: mmPx(1.5, s), fontWeight: 600, lineHeight: 1.2 }}>{fmtDate(form.expiryDate)}</span>
            </div>
          </div>

          {/* QR section */}
          {showQR && qrData && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: mmPx(0.5, s), flexShrink: 0, width: mmPx(11, s) }}>
              <img src={qrData} alt="QR" style={{ width: mmPx(9, s), height: mmPx(9, s), borderRadius: mmPx(0.5, s) }} />
              <span style={{ color: prim, fontSize: mmPx(1, s), fontWeight: 700, letterSpacing: '0.3px', textAlign: 'center', lineHeight: 1.2 }}>SCAN</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: mmPx(4.5, s),
          background: `${prim}08`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: `0 ${padX}px`,
        }}>
          {showBarcode ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: mmPx(1, s) }}>
              <div style={{
                height: mmPx(2.2, s), background: `repeating-linear-gradient(90deg, ${dark} 0px, ${dark} 0.3px, transparent 0.3px, transparent 0.6px)`,
                width: mmPx(15, s), borderRadius: mmPx(0.2, s),
              }} />
              <span style={{ color: muted, fontSize: mmPx(1.3, s), fontWeight: 500, letterSpacing: '0.3px' }}>{form.idNumber}</span>
            </div>
          ) : (
            <span style={{ color: muted, fontSize: mmPx(1.2, s), opacity: 0.5 }}>{form.companyName} &bull; Official ID</span>
          )}
          {showSignature && signatureFile && (
            <img src={signatureFile} alt="Signature" style={{ height: mmPx(2.5, s), opacity: 0.5, marginLeft: mmPx(2, s) }} />
          )}
        </div>

        {/* Watermark */}
        {showWatermark && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-30deg)',
            fontSize: mmPx(8, s), fontWeight: 900, color: `${prim}`, opacity: 0.035,
            whiteSpace: 'nowrap', pointerEvents: 'none', letterSpacing: mmPx(1.5, s),
            textTransform: 'uppercase',
          }}>
            {form.companyName || 'SKOOLAR'}
          </div>
        )}
      </div>
    );
  }

  function renderPortraitFront(w: number, h: number, c: ColorTheme, s: number) {
    const padX = mmPx(2.5, s);
    const photoSize = mmPx(10, s);
    const prim = c.primary;
    const primD = c.headerBg;
    const accent = c.accent;
    const dark = c.text;
    const muted = c.textSecondary;
    const hdrTxt = '#ffffff';

    return (
      <div style={{ width: '100%', height: '100%', background: c.bg, position: 'relative', overflow: 'hidden' }}>
        {/* Top accent line */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: mmPx(2.8, s), background: `linear-gradient(90deg, ${primD}, ${prim})`, zIndex: 2 }} />

        {/* Header */}
        <div style={{
          position: 'absolute', top: mmPx(2.8, s), left: 0, right: 0, height: mmPx(12, s),
          background: `linear-gradient(135deg, ${primD}, ${prim})`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: `0 ${padX}px`, zIndex: 1,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: mmPx(1.5, s) }}>
            {showLogo && logoFile && (
              <img src={logoFile} alt="Logo" style={{ width: mmPx(5, s), height: mmPx(5, s), borderRadius: mmPx(0.8, s), objectFit: 'contain', background: 'rgba(255,255,255,0.15)', flexShrink: 0 }} />
            )}
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: hdrTxt, fontWeight: 700, fontSize: mmPx(2.4, s), lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {form.companyName || 'COMPANY'}
              </div>
              <div style={{ color: hdrTxt, fontSize: mmPx(1.2, s), opacity: 0.7, fontStyle: 'italic', lineHeight: 1.2 }}>
                {cardType === 'staff' ? 'STAFF ID CARD' : 'STUDENT ID CARD'}
              </div>
            </div>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.18)', color: hdrTxt, fontSize: mmPx(1.4, s), fontWeight: 700,
            padding: `${mmPx(0.5, s)}px ${mmPx(1.5, s)}px`, borderRadius: mmPx(2, s),
            letterSpacing: '0.5px', marginTop: mmPx(0.5, s), backdropFilter: 'blur(2px)',
          }}>
            {cardType === 'staff' ? 'STAFF' : 'STUDENT'}
          </div>
        </div>

        {/* Body */}
        <div style={{
          position: 'absolute', top: mmPx(15.5, s), left: 0, right: 0, bottom: mmPx(4.5, s),
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: `${mmPx(1.5, s)}px ${padX}px`, gap: mmPx(1, s),
        }}>
          {showPhoto && (
            <div style={{ position: 'relative' }}>
              <div style={{
                width: photoSize, height: photoSize, borderRadius: '50%',
                background: `${prim}08`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', border: `2px solid ${prim}30`,
                boxShadow: `0 ${mmPx(0.8, s)}px ${mmPx(1.5, s)}px ${prim}15`,
                flexShrink: 0,
              }}>
                {photoFile ? (
                  <img src={photoFile} alt="Photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: mmPx(4, s), fontWeight: 700, color: prim, opacity: 0.35 }}>
                    {(form.firstName[0] || '') + (form.lastName[0] || '') || '?'}
                  </span>
                )}
              </div>
              {form.bloodGroup && (
                <div style={{
                  position: 'absolute', top: mmPx(1, s), right: 0,
                  background: accent, color: '#000', fontSize: mmPx(1.3, s), fontWeight: 700,
                  padding: `${mmPx(0.2, s)}px ${mmPx(1.2, s)}px`, borderRadius: mmPx(0.8, s),
                  lineHeight: 1.2,
                }}>
                  {form.bloodGroup}
                </div>
              )}
            </div>
          )}

          <div style={{ color: dark, fontWeight: 800, fontSize: mmPx(2.8, s), lineHeight: 1.15, textAlign: 'center', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {form.firstName} {form.lastName}
          </div>
          <div style={{
            background: `${prim}12`, color: prim, fontWeight: 700, fontSize: mmPx(1.5, s),
            padding: `${mmPx(0.4, s)}px ${mmPx(2, s)}px`, borderRadius: mmPx(2, s),
            lineHeight: 1.3,
          }}>
            {form.role || 'N/A'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: mmPx(2, s), rowGap: mmPx(0.4, s), width: '100%', marginTop: mmPx(0.5, s) }}>
            <span style={{ color: muted, fontSize: mmPx(1.3, s), fontWeight: 500, lineHeight: 1.2 }}>ID No</span>
            <span style={{ color: dark, fontSize: mmPx(1.4, s), fontWeight: 600, lineHeight: 1.2, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis' }}>{form.idNumber}</span>
            <span style={{ color: muted, fontSize: mmPx(1.3, s), fontWeight: 500, lineHeight: 1.2 }}>Dept</span>
            <span style={{ color: dark, fontSize: mmPx(1.4, s), fontWeight: 600, lineHeight: 1.2, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis' }}>{form.department || 'N/A'}</span>
            {form.phone && (<><span style={{ color: muted, fontSize: mmPx(1.3, s), fontWeight: 500, lineHeight: 1.2 }}>Phone</span><span style={{ color: dark, fontSize: mmPx(1.4, s), fontWeight: 600, lineHeight: 1.2, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis' }}>{form.phone}</span></>)}
            <span style={{ color: muted, fontSize: mmPx(1.3, s), fontWeight: 500, lineHeight: 1.2 }}>Issued</span>
            <span style={{ color: dark, fontSize: mmPx(1.4, s), fontWeight: 600, lineHeight: 1.2, textAlign: 'right' }}>{fmtDate(form.issueDate)}</span>
            <span style={{ color: muted, fontSize: mmPx(1.3, s), fontWeight: 500, lineHeight: 1.2 }}>Expires</span>
            <span style={{ color: accent, fontSize: mmPx(1.4, s), fontWeight: 600, lineHeight: 1.2, textAlign: 'right' }}>{fmtDate(form.expiryDate)}</span>
          </div>

          {showQR && qrData && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: mmPx(0.3, s), marginTop: mmPx(0.5, s) }}>
              <img src={qrData} alt="QR" style={{ width: mmPx(8, s), height: mmPx(8, s), borderRadius: mmPx(0.5, s) }} />
              <span style={{ color: prim, fontSize: mmPx(1, s), fontWeight: 700, letterSpacing: '0.3px', textAlign: 'center' }}>SCAN FOR ATTENDANCE</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: mmPx(4.5, s),
          background: `${prim}08`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: `0 ${padX}px`,
        }}>
          <span style={{ color: muted, fontSize: mmPx(1.2, s), opacity: 0.5 }}>{form.companyName} &bull; Official ID Card</span>
        </div>

        {/* Watermark */}
        {showWatermark && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-30deg)',
            fontSize: mmPx(7, s), fontWeight: 900, color: `${prim}`, opacity: 0.03,
            whiteSpace: 'nowrap', pointerEvents: 'none', letterSpacing: mmPx(1.5, s),
            textTransform: 'uppercase',
          }}>
            {form.companyName || 'SKOOLAR'}
          </div>
        )}
      </div>
    );
  }

  // ÔöÇÔöÇ Back Side ÔöÇÔöÇ
  function renderBack(w: number, h: number, _r: number, c: ColorTheme, s: number, parsedText: string) {
    const isLandscape = orientation === 'landscape';

    if (isLandscape) {
      return renderLandscapeBack(w, h, c, s, parsedText);
    }
    return renderPortraitBack(w, h, c, s, parsedText);
  }

  function renderLandscapeBack(w: number, h: number, c: ColorTheme, s: number, parsedText: string) {
    const padX = mmPx(2.8, s);
    const prim = c.primary;
    const primD = c.headerBg;
    const dark = c.text;
    const muted = c.textSecondary;
    const hdrTxt = '#ffffff';

    return (
      <div style={{ width: '100%', height: '100%', background: c.bg, position: 'relative', overflow: 'hidden' }}>
        {/* Top accent line */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: mmPx(2.8, s), background: `linear-gradient(90deg, ${primD}, ${prim})`, zIndex: 2 }} />

        {/* Header */}
        <div style={{
          position: 'absolute', top: mmPx(2.8, s), left: 0, right: 0, height: mmPx(9, s),
          background: `linear-gradient(135deg, ${primD}, ${prim})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1,
        }}>
          <span style={{ color: hdrTxt, fontWeight: 700, fontSize: mmPx(2.2, s), letterSpacing: '1px' }}>
            {form.companyName} &mdash; BACK OF ID CARD
          </span>
        </div>

        {/* Body */}
        <div style={{
          position: 'absolute', top: mmPx(12.5, s), left: 0, right: 0, bottom: mmPx(3, s),
          display: 'flex', padding: `${mmPx(2, s)}px ${padX}px`, gap: mmPx(2, s),
        }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: mmPx(1, s) }}>
            <div style={{ color: prim, fontWeight: 700, fontSize: mmPx(1.5, s), letterSpacing: '0.5px' }}>TERMS & CONDITIONS</div>
            <div style={{ height: '0.3px', background: `${prim}20`, marginBottom: mmPx(0.3, s) }} />
            <div style={{ color: dark, fontSize: mmPx(1.3, s), lineHeight: 1.5, opacity: 0.85, whiteSpace: 'pre-wrap' }}>
              {parsedText}
            </div>
          </div>

          {showQR && qrData && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: mmPx(0.5, s),
              borderLeft: `0.3px solid ${prim}15`, paddingLeft: mmPx(2, s), flexShrink: 0, width: mmPx(12, s),
            }}>
              <img src={qrData} alt="QR" style={{ width: mmPx(9, s), height: mmPx(9, s), borderRadius: mmPx(0.5, s) }} />
              <span style={{ color: prim, fontSize: mmPx(0.9, s), fontWeight: 700, textAlign: 'center', letterSpacing: '0.3px' }}>SCAN TO<br/>VERIFY</span>
            </div>
          )}
        </div>

        {/* Watermark */}
        {showWatermark && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-30deg)',
            fontSize: mmPx(7, s), fontWeight: 900, color: `${prim}`, opacity: 0.03,
            whiteSpace: 'nowrap', pointerEvents: 'none', letterSpacing: mmPx(2, s),
            textTransform: 'uppercase',
          }}>
            {form.companyName || 'SKOOLAR'}
          </div>
        )}
      </div>
    );
  }

  function renderPortraitBack(w: number, h: number, c: ColorTheme, s: number, parsedText: string) {
    const padX = mmPx(2.5, s);
    const prim = c.primary;
    const primD = c.headerBg;
    const dark = c.text;
    const muted = c.textSecondary;
    const hdrTxt = '#ffffff';

    return (
      <div style={{ width: '100%', height: '100%', background: c.bg, position: 'relative', overflow: 'hidden' }}>
        {/* Top accent line */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: mmPx(2.8, s), background: `linear-gradient(90deg, ${primD}, ${prim})`, zIndex: 2 }} />

        {/* Header */}
        <div style={{
          position: 'absolute', top: mmPx(2.8, s), left: 0, right: 0, height: mmPx(11, s),
          background: `linear-gradient(135deg, ${primD}, ${prim})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1,
        }}>
          <span style={{ color: hdrTxt, fontWeight: 700, fontSize: mmPx(2, s), letterSpacing: '0.5px', textAlign: 'center' }}>
            {form.companyName} &mdash; BACK OF ID CARD
          </span>
        </div>

        {/* Body */}
        <div style={{
          position: 'absolute', top: mmPx(14.5, s), left: 0, right: 0, bottom: mmPx(3, s),
          display: 'flex', flexDirection: 'column', padding: `${mmPx(2, s)}px ${padX}px`, gap: mmPx(1.5, s),
        }}>
          <div style={{ color: prim, fontWeight: 700, fontSize: mmPx(1.4, s), letterSpacing: '0.5px' }}>TERMS & CONDITIONS</div>
          <div style={{ height: '0.3px', background: `${prim}20` }} />
          <div style={{ color: dark, fontSize: mmPx(1.2, s), lineHeight: 1.5, opacity: 0.85, whiteSpace: 'pre-wrap' }}>
            {parsedText}
          </div>

          {showQR && qrData && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: mmPx(1.5, s), marginTop: mmPx(0.5, s) }}>
              <img src={qrData} alt="QR" style={{ width: mmPx(7, s), height: mmPx(7, s), borderRadius: mmPx(0.3, s) }} />
              <span style={{ color: prim, fontSize: mmPx(0.9, s), fontWeight: 700, letterSpacing: '0.3px' }}>SCAN TO VERIFY</span>
            </div>
          )}
        </div>

        {/* Watermark */}
        {showWatermark && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-30deg)',
            fontSize: mmPx(6, s), fontWeight: 900, color: `${prim}`, opacity: 0.025,
            whiteSpace: 'nowrap', pointerEvents: 'none', letterSpacing: mmPx(2, s),
            textTransform: 'uppercase',
          }}>
            {form.companyName || 'SKOOLAR'}
          </div>
        )}
      </div>
    );
  }

  const inputCls = 'h-7 text-xs';

  return (
    <div className="space-y-4">
      {/* ÔöÇÔöÇ Header ÔöÇÔöÇ */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold tracking-tight">ID Card Generator</h2>
          <Badge variant="outline" className="text-[10px]">
            <CreditCard className="size-3 mr-1" />
            Client-Side Instant
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} className="h-7 text-xs">
            <RotateCcw className="size-3 mr-1" /> Reset
          </Button>
          <Button
            variant="ghost" size="sm"
            onClick={() => setFullscreen(!fullscreen)}
            className="h-7 text-xs"
          >
            {fullscreen ? <Minimize2 className="size-3 mr-1" /> : <Maximize2 className="size-3 mr-1" />}
            {fullscreen ? 'Compact' : 'Fullscreen'}
          </Button>
        </div>
      </div>

      {/* ÔöÇÔöÇ Main Grid ÔöÇÔöÇ */}
      <div className={cn('grid gap-4', fullscreen ? 'grid-cols-[320px_1fr]' : 'grid-cols-1 xl:grid-cols-[340px_1fr]')}>
        {/* ÔöÇÔöÇ LEFT: Controls ÔöÇÔöÇ */}
        <div className="space-y-3 max-h-[calc(100vh-140px)] overflow-y-auto pr-1">
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="w-full grid grid-cols-4 h-8">
              <TabsTrigger value="info" className="text-[10px]"><User className="size-3 mr-1" />Info</TabsTrigger>
              <TabsTrigger value="design" className="text-[10px]"><Palette className="size-3 mr-1" />Design</TabsTrigger>
              <TabsTrigger value="back" className="text-[10px]"><QrCode className="size-3 mr-1" />Back</TabsTrigger>
              <TabsTrigger value="export" className="text-[10px]"><Download className="size-3 mr-1" />Export</TabsTrigger>
            </TabsList>

            {/* ÔöÇÔöÇ Info Tab ÔöÇÔöÇ */}
            <TabsContent value="info" className="space-y-2.5 mt-2">
              <Card className="border shadow-none">
                <CardContent className="p-3 space-y-2.5">
                  {/* Card Type */}
                  <div className="flex gap-2">
                    {(['staff', 'student'] as CardType[]).map(t => (
                      <Button
                        key={t}
                        type="button"
                        variant={cardType === t ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setCardType(t)}
                        className="flex-1 h-7 text-xs"
                      >
                        {t === 'staff' ? <User className="size-3 mr-1" /> : <GraduationCap className="size-3 mr-1" />}
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </Button>
                    ))}
                  </div>

                  <Separator />

                  {/* Personal Info - 2-col grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1"><Label className="text-[10px]">First Name</Label><Input value={form.firstName} onChange={e => updateForm('firstName', e.target.value)} className={inputCls} /></div>
                    <div className="space-y-1"><Label className="text-[10px]">Last Name</Label><Input value={form.lastName} onChange={e => updateForm('lastName', e.target.value)} className={inputCls} /></div>
                    <div className="space-y-1"><Label className="text-[10px]">Role / Title</Label><Input value={form.role} onChange={e => updateForm('role', e.target.value)} className={inputCls} /></div>
                    <div className="space-y-1"><Label className="text-[10px]">Department / Class</Label><Input value={form.department} onChange={e => updateForm('department', e.target.value)} className={inputCls} /></div>
                    <div className="space-y-1"><Label className="text-[10px]">ID Number</Label><Input value={form.idNumber} onChange={e => updateForm('idNumber', e.target.value)} className={inputCls} /></div>
                    <div className="space-y-1"><Label className="text-[10px]">Blood Group</Label>
                      <select value={form.bloodGroup} onChange={e => updateForm('bloodGroup', e.target.value)}
                        className="flex h-7 w-full rounded-md border border-input bg-background px-2 text-xs ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {BLOOD_GROUPS.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1"><Label className="text-[10px]">Phone</Label><Input value={form.phone} onChange={e => updateForm('phone', e.target.value)} className={inputCls} /></div>
                    <div className="space-y-1"><Label className="text-[10px]">Email</Label><Input value={form.email} onChange={e => updateForm('email', e.target.value)} className={inputCls} /></div>
                    <div className="col-span-2 space-y-1"><Label className="text-[10px]">Address</Label><Input value={form.address} onChange={e => updateForm('address', e.target.value)} className={inputCls} /></div>
                    <div className="space-y-1"><Label className="text-[10px]">Date of Birth</Label><Input type="date" value={form.dateOfBirth} onChange={e => updateForm('dateOfBirth', e.target.value)} className={inputCls} /></div>
                    <div className="space-y-1"><Label className="text-[10px]">Signature Name</Label><Input value={form.signatureName} onChange={e => updateForm('signatureName', e.target.value)} className={inputCls} /></div>
                  </div>

                  <Separator />

                  {/* Company */}
                  <div className="space-y-1"><Label className="text-[10px]">Company / School Name</Label><Input value={form.companyName} onChange={e => updateForm('companyName', e.target.value)} className={inputCls} /></div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1"><Label className="text-[10px]">Issue Date</Label><Input type="date" value={form.issueDate} onChange={e => updateForm('issueDate', e.target.value)} className={inputCls} /></div>
                    <div className="space-y-1"><Label className="text-[10px]">Expiry Date</Label><Input type="date" value={form.expiryDate} onChange={e => updateForm('expiryDate', e.target.value)} className={inputCls} /></div>
                  </div>

                  <Separator />

                  {/* File Uploads */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-medium">Uploads</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Logo', value: logoFile, setter: setLogoFile, icon: Building2, accept: 'image/*' },
                        { label: 'Photo', value: photoFile, setter: setPhotoFile, icon: Camera, accept: 'image/*' },
                        { label: 'Signature', value: signatureFile, setter: setSignatureFile, icon: Image, accept: 'image/*' },
                      ].map(item => (
                        <div key={item.label}>
                          <Label className="text-[9px] text-muted-foreground">{item.label}</Label>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Button
                              variant="outline" size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = item.accept;
                                input.onchange = (e: any) => {
                                  const file = e.target?.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onload = () => item.setter(reader.result as string);
                                    reader.readAsDataURL(file);
                                  }
                                };
                                input.click();
                              }}
                            >
                              {item.value ? <Check className="size-3 text-emerald-500" /> : <Plus className="size-3" />}
                            </Button>
                            {item.value && (
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => item.setter(null)}>
                                <X className="size-3 text-red-400" />
                              </Button>
                            )}
                            <span className="text-[9px] text-muted-foreground truncate max-w-[50px]">
                              {item.value ? 'Set' : 'Add'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ÔöÇÔöÇ Design Tab ÔöÇÔöÇ */}
            <TabsContent value="design" className="space-y-2.5 mt-2">
              <Card className="border shadow-none">
                <CardContent className="p-3 space-y-3">
                  {/* Layout */}
                  {/* Font Size */}
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-medium">Font Size</Label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {FONT_SIZES.map(f => (
                        <Button key={f.value} variant={fontSize === f.value ? 'default' : 'outline'} size="sm" onClick={() => setFontSize(f.value)} className="h-7 text-[10px]">
                          <Type className="size-2.5 mr-1" />{f.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Orientation */}
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-medium">Orientation</Label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <Button variant={orientation === 'landscape' ? 'default' : 'outline'} size="sm" onClick={() => setOrientation('landscape')} className="h-7 text-[10px]">
                        <Maximize2 className="size-2.5 mr-1" />Landscape
                      </Button>
                      <Button variant={orientation === 'portrait' ? 'default' : 'outline'} size="sm" onClick={() => setOrientation('portrait')} className="h-7 text-[10px]">
                        <Maximize2 className="size-2.5 mr-1 rotate-90" />Portrait
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  {/* Color Theme */}
                  <ColorThemePicker theme={theme} onChange={t => { setTheme(t); setCustomColorMode(false); }} />

                  {/* Custom Colors */}
                  <div className="flex items-center gap-2">
                    <Switch id="customColors" checked={customColorMode} onCheckedChange={setCustomColorMode} />
                    <Label htmlFor="customColors" className="text-[10px]">Custom Colors</Label>
                  </div>

                  {customColorMode && (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[9px]">Primary</Label>
                        <Input type="color" value={customPrimary} onChange={e => setCustomPrimary(e.target.value)} className="h-7 p-0.5 cursor-pointer" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px]">Secondary</Label>
                        <Input type="color" value={customSecondary} onChange={e => setCustomSecondary(e.target.value)} className="h-7 p-0.5 cursor-pointer" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px]">Accent</Label>
                        <Input type="color" value={customAccent} onChange={e => setCustomAccent(e.target.value)} className="h-7 p-0.5 cursor-pointer" />
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* Toggles */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-medium">Show / Hide Elements</Label>
                    {[
                      { label: 'Profile Photo', value: showPhoto, setter: setShowPhoto, icon: Camera },
                      { label: 'Company Logo', value: showLogo, setter: setShowLogo, icon: Building2 },
                      { label: 'QR Code (Back)', value: showQR, setter: setShowQR, icon: QrCode },
                      { label: 'Barcode', value: showBarcode, setter: setShowBarcode, icon: Hash },
                      { label: 'Signature', value: showSignature, setter: setShowSignature, icon: Image },
                      { label: 'Watermark', value: showWatermark, setter: setShowWatermark, icon: FileImage },
                    ].map(item => (
                      <div key={item.label} className="flex items-center justify-between">
                        <Label className="text-[10px] flex items-center gap-1.5">
                          <item.icon className="size-2.5" /> {item.label}
                        </Label>
                        <Switch checked={item.value} onCheckedChange={item.setter} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ÔöÇÔöÇ Back Tab ÔöÇÔöÇ */}
            <TabsContent value="back" className="space-y-2.5 mt-2">
              <Card className="border shadow-none">
                <CardContent className="p-3 space-y-3">
                  {/* Back text */}
                  <div className="space-y-1">
                    <Label className="text-[10px] font-medium">Back Card Message</Label>
                    <Textarea
                      value={backText}
                      onChange={e => setBackText(e.target.value)}
                      className="min-h-[100px] text-xs resize-none"
                    />
                    <p className="text-[9px] text-muted-foreground">Use {'{company}'}, {'{name}'}, {'{id}'} as placeholders</p>
                  </div>

                  <Separator />

                  {/* QR Data Selection */}
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-medium">QR Code Includes</Label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {qrOptions.map(opt => (
                        <div key={opt.key} className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            id={`qr-${opt.key}`}
                            checked={qrSelection.includes(opt.key)}
                            onChange={() => toggleQrSelection(opt.key)}
                            className="size-3"
                          />
                          <Label htmlFor={`qr-${opt.key}`} className="text-[10px] cursor-pointer">{opt.label}</Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* QR Preview */}
                  {qrData && (
                    <div className="flex justify-center">
                      <img src={qrData} alt="QR Code" className="w-16 h-16 border rounded" />
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ÔöÇÔöÇ Export Tab ÔöÇÔöÇ */}
            <TabsContent value="export" className="space-y-2.5 mt-2">
              <Card className="border shadow-none">
                <CardContent className="p-3 space-y-3">
                  <Label className="text-[10px] font-medium">Download Options</Label>

                  <div className="flex flex-col gap-2">
                    <Button onClick={handleExportPNG} disabled={exporting} size="sm" className="h-8 text-xs justify-start">
                      {exporting ? <Loader2 className="size-3.5 mr-2 animate-spin" /> : <FileImage className="size-3.5 mr-2" />}
                      Export as PNG
                    </Button>
                    <Button onClick={handleExportPDF} disabled={exporting} size="sm" className="h-8 text-xs justify-start">
                      {exporting ? <Loader2 className="size-3.5 mr-2 animate-spin" /> : <Download className="size-3.5 mr-2" />}
                      Export as PDF
                    </Button>
                    <Button onClick={handlePrint} disabled={exporting} size="sm" variant="outline" className="h-8 text-xs justify-start">
                      <Printer className="size-3.5 mr-2" /> Print Card
                    </Button>
                  </div>

                  <Separator />

                  <div className="text-[9px] text-muted-foreground space-y-1">
                    <p>Format: CR80 (85.6 x 53.98 mm)</p>
                    <p>All processing is done client-side. Nothing is saved to the database.</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* ÔöÇÔöÇ RIGHT: Preview ÔöÇÔöÇ */}
        <div ref={previewRef} className="flex flex-col items-center justify-start gap-3 pt-2">
          {/* Side Toggle */}
          <div className="flex items-center gap-2">
            <Button
              variant={side === 'front' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSide('front')}
              className="h-7 text-xs"
            >
              <Eye className="size-3 mr-1" /> Front
            </Button>
            <Button
              variant={side === 'back' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSide('back')}
              className="h-7 text-xs"
            >
              <EyeOff className="size-3 mr-1" /> Back
            </Button>
          </div>

          {/* Card Preview */}
          <div
            className="relative transition-all duration-200"
            style={{
              width: `${pw}px`,
              height: `${ph}px`,
              boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
              borderRadius: `${corner}px`,
            }}
          >
            {renderCard()}

            {/* Orientation badge */}
            <div className="absolute -top-3 -right-3 z-10">
              <Badge variant="secondary" className="text-[9px] shadow-sm px-1.5 py-0">
                {cardW} x {cardH} mm
              </Badge>
            </div>
          </div>

          {/* Thumbnail strip with both sides */}
          <div className="flex gap-2 items-center mt-1">
            <div
              className="cursor-pointer opacity-70 hover:opacity-100 transition-opacity"
              onClick={() => setSide('front')}
              style={{
                width: mmPx(cardW, 1.5),
                height: mmPx(cardH, 1.5),
                borderRadius: mmPx(ROUNDED, 1.5),
                overflow: 'hidden',
                border: side === 'front' ? `2px solid ${activeTheme.primary}` : '2px solid transparent',
              }}
            >
              <div style={{
                width: '100%', height: '25%', background: activeTheme.headerBg,
              }} />
              <div style={{ width: '100%', height: '75%', background: activeTheme.bg }} />
            </div>
            <span className="text-[9px] text-muted-foreground">Front</span>

            <ChevronRight className="size-3 text-muted-foreground" />

            <div
              className="cursor-pointer opacity-70 hover:opacity-100 transition-opacity"
              onClick={() => setSide('back')}
              style={{
                width: mmPx(cardW, 1.5),
                height: mmPx(cardH, 1.5),
                borderRadius: mmPx(ROUNDED, 1.5),
                overflow: 'hidden',
                border: side === 'back' ? `2px solid ${activeTheme.primary}` : '2px solid transparent',
              }}
            >
              <div style={{ width: '100%', height: '100%', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {showQR && <QrCode className="size-3 text-gray-300" />}
              </div>
            </div>
            <span className="text-[9px] text-muted-foreground">Back</span>
          </div>

          {/* Action buttons below card */}
          <div className="flex items-center gap-2 mt-1">
            <Button onClick={handleExportPNG} disabled={exporting} size="sm" className="h-8 text-xs">
              {exporting ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <FileImage className="size-3.5 mr-1.5" />}
              PNG
            </Button>
            <Button onClick={handleExportPDF} disabled={exporting} size="sm" className="h-8 text-xs">
              {exporting ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Download className="size-3.5 mr-1.5" />}
              PDF
            </Button>
            <Button onClick={handlePrint} disabled={exporting} size="sm" variant="outline" className="h-8 text-xs">
              <Printer className="size-3.5 mr-1.5" /> Print
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
