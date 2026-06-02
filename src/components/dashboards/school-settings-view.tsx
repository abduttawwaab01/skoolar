'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Settings,
  Save,
  Palette,
  Type,
  BookOpen,
  FileText,
  AlertCircle,
  CheckCircle,
  Clock,
  ChevronDown,
  Shield,
  School,
  Star,
  Zap,
  Crown,
  ArrowRight,
  X,
  CreditCard,
  Users,
  GraduationCap,
  Loader2,
} from 'lucide-react';

// --- Types ---
interface SchoolSettingsData {
  id: string;
  schoolId: string;
  scoreSystem: string;
  fontFamily: string;
  theme: string;
  schoolMotto: string | null;
  schoolVision: string | null;
  schoolMission: string | null;
  principalName: string | null;
  vicePrincipalName: string | null;
  nextTermBegins: string | null;
  academicSession: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ScoreTypeData {
  id: string;
  schoolId: string;
  name: string;
  type: string;
  maxMarks: number;
  weight: number;
  position: number;
  isInReport: boolean;
  isActive: boolean;
}

// --- Constants ---
const themeOptions = [
  {
    id: 'default',
    name: 'Default',
    description: 'Classic emerald green theme',
    color: 'bg-emerald-600',
    borderColor: 'border-emerald-300',
    ringColor: 'ring-emerald-500',
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Clean blue professional look',
    color: 'bg-blue-600',
    borderColor: 'border-blue-300',
    ringColor: 'ring-blue-500',
  },
  {
    id: 'classic',
    name: 'Classic',
    description: 'Traditional burgundy elegance',
    color: 'bg-red-800',
    borderColor: 'border-red-300',
    ringColor: 'ring-red-500',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Sleek slate simplicity',
    color: 'bg-slate-700',
    borderColor: 'border-slate-300',
    ringColor: 'ring-slate-500',
  },
];

const fontOptions = [
  { value: 'Inter', label: 'Inter', style: { fontFamily: "'Inter', sans-serif" } as React.CSSProperties },
  { value: 'Roboto', label: 'Roboto', style: { fontFamily: "'Roboto', sans-serif" } as React.CSSProperties },
  { value: 'Georgia', label: 'Georgia', style: { fontFamily: "'Georgia', serif" } as React.CSSProperties },
  { value: 'Arial', label: 'Arial', style: { fontFamily: "'Arial', sans-serif" } as React.CSSProperties },
];

const defaultScoreTypes: ScoreTypeData[] = [
  { id: 'st-midterm', schoolId: '', name: 'Mid-Term (CA)', type: 'midterm', maxMarks: 40, weight: 40, position: 0, isInReport: true, isActive: true },
  { id: 'st-exam', schoolId: '', name: 'Exam', type: 'exam', maxMarks: 60, weight: 60, position: 1, isInReport: true, isActive: true },
];

const scoreTypeColors: Record<string, { bg: string; text: string; border: string }> = {
  daily: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
  weekly: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  midterm: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  exam: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
};

const scoreTypeIcons: Record<string, React.ElementType> = {
  daily: BookOpen,
  weekly: Star,
  midterm: FileText,
  exam: GraduationCap,
};

// --- Component ---
export function SchoolSettingsView() {
  const { currentUser, currentRole } = useAppStore();
  const schoolId = currentUser.schoolId;

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [settings, setSettings] = React.useState<SchoolSettingsData | null>(null);
  const [scoreTypes, setScoreTypes] = React.useState<ScoreTypeData[]>([]);

  // Form state
  const [scoreSystem, setScoreSystem] = React.useState('midterm_exam');
  const [fontFamily, setFontFamily] = React.useState('Inter');
  const [theme, setTheme] = React.useState('default');
  const [schoolMotto, setSchoolMotto] = React.useState('');
  const [schoolVision, setSchoolVision] = React.useState('');
  const [schoolMission, setSchoolMission] = React.useState('');
  const [principalName, setPrincipalName] = React.useState('');
  const [vicePrincipalName, setVicePrincipalName] = React.useState('');
  const [academicSession, setAcademicSession] = React.useState('');
  const [nextTermBegins, setNextTermBegins] = React.useState('');
  const [bankName, setBankName] = React.useState('');
  const [bankAccountName, setBankAccountName] = React.useState('');
  const [bankAccountNumber, setBankAccountNumber] = React.useState('');

  // Fetch settings
  React.useEffect(() => {
    async function fetchSettings() {
      if (!schoolId) return;
      try {
        setLoading(true);

        const [settingsRes, scoreTypesRes, bankRes] = await Promise.all([
          fetch(`/api/school-settings?schoolId=${schoolId}`),
          fetch(`/api/score-types?schoolId=${schoolId}`),
          fetch(`/api/schools/${schoolId}/bank`),
        ]);

        if (settingsRes.ok) {
          const settingsJson = await settingsRes.json();
          if (settingsJson.data) {
            const s = settingsJson.data;
            setSettings(s);
            setScoreSystem(s.scoreSystem || 'midterm_exam');
            setFontFamily(s.fontFamily || 'Inter');
            setTheme(s.theme || 'default');
            setSchoolMotto(s.schoolMotto || '');
            setSchoolVision(s.schoolVision || '');
            setSchoolMission(s.schoolMission || '');
            setPrincipalName(s.principalName || '');
            setVicePrincipalName(s.vicePrincipalName || '');
            setAcademicSession(s.academicSession || '');
            setNextTermBegins(s.nextTermBegins ? s.nextTermBegins.split('T')[0] : '');
          } else {
            // Auto-create settings on first load
            const createRes = await fetch('/api/school-settings', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                schoolId,
                scoreSystem: 'midterm_exam',
                fontFamily: 'Inter',
                theme: 'default',
              }),
            });
            if (createRes.ok) {
              const created = await createRes.json();
              if (created.data) setSettings(created.data);
            }
          }
        }

        if (scoreTypesRes.ok) {
          const scoreTypesJson = await scoreTypesRes.json();
          const fetched = scoreTypesJson.data || [];
          if (fetched.length > 0) {
            setScoreTypes(fetched);
          } else {
            setScoreTypes(defaultScoreTypes.map((st) => ({ ...st, schoolId })));
          }
        }

        if (bankRes.ok) {
          const bankJson = await bankRes.json();
          const bank = bankJson.data || bankJson.school;
          if (bank) {
            setBankName(bank.bankName || '');
            setBankAccountName(bank.bankAccountName || '');
            setBankAccountNumber(bank.bankAccountNumber || '');
          }
        }
      } catch {
        toast.error('Failed to load school settings');
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, [schoolId]);

  // Reset score types to defaults
  const resetScoreTypes = () => {
    setScoreTypes(defaultScoreTypes.map((st) => ({ ...st, schoolId })));
  };

  // Update individual score type
  const updateScoreType = (index: number, field: keyof ScoreTypeData, value: string | number | boolean) => {
    setScoreTypes((prev) =>
      prev.map((st, i) => (i === index ? { ...st, [field]: value } : st))
    );
  };

  // Save settings
  const handleSave = async () => {
    if (!schoolId) return;
    try {
      setSaving(true);

      // Save school settings
      const settingsRes = await fetch('/api/school-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId,
          scoreSystem,
          fontFamily,
          theme,
          schoolMotto: schoolMotto || null,
          schoolVision: schoolVision || null,
          schoolMission: schoolMission || null,
          principalName: principalName || null,
          vicePrincipalName: vicePrincipalName || null,
          academicSession: academicSession || null,
          nextTermBegins: nextTermBegins || null,
        }),
      });

      if (!settingsRes.ok) {
        const json = await settingsRes.json();
        toast.error(json.error || 'Failed to save settings');
        return;
      }

      // Save score types (create or update each)
      for (const st of scoreTypes) {
        const payload = {
          schoolId,
          name: st.name,
          type: st.type,
          maxMarks: st.maxMarks,
          weight: st.weight,
          position: st.position,
          isInReport: st.isInReport,
          isActive: st.isActive,
        };

        if (st.id.startsWith('st-')) {
          // New (default) score type - create via POST
          await fetch('/api/score-types', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        } else {
          // Existing score type - update via PUT
          await fetch('/api/score-types', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: st.id, ...payload }),
          });
        }
      }

      const settingsJson = await settingsRes.json();
      setSettings(settingsJson.data);

      // Save bank details
      await fetch(`/api/schools/${schoolId}/bank`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankName, bankAccountName, bankAccountNumber }),
      });

      toast.success('School settings saved successfully');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = React.useMemo(() => {
    if (!settings) return true;
    return (
      scoreSystem !== settings.scoreSystem ||
      fontFamily !== settings.fontFamily ||
      theme !== settings.theme ||
      schoolMotto !== (settings.schoolMotto || '') ||
      schoolVision !== (settings.schoolVision || '') ||
      schoolMission !== (settings.schoolMission || '') ||
      principalName !== (settings.principalName || '') ||
      vicePrincipalName !== (settings.vicePrincipalName || '') ||
      academicSession !== (settings.academicSession || '') ||
      nextTermBegins !== (settings.nextTermBegins ? settings.nextTermBegins.split('T')[0] : '') ||
      bankName !== '' ||
      bankAccountName !== '' ||
      bankAccountNumber !== ''
    );
  }, [settings, scoreSystem, fontFamily, theme, schoolMotto, schoolVision, schoolMission, principalName, vicePrincipalName, academicSession, nextTermBegins, bankName, bankAccountName, bankAccountNumber]);

  // --- Loading State ---
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-7 w-48 mb-1" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
        <Skeleton className="h-80 rounded-xl" />
        <div className="flex justify-end">
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">School Settings</h2>
          <p className="text-sm text-muted-foreground">Configure scoring, appearance, and school information</p>
        </div>
        <Button
          className="gap-2 min-w-0 w-full sm:w-auto sm:min-w-[140px]"
          onClick={handleSave}
          disabled={saving || !hasChanges}
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Score System Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-100">
                <FileText className="size-4.5 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-base">Score System</CardTitle>
                <CardDescription>Choose how student scores are calculated</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
              <div className="flex items-center gap-2 mb-1">
                <GraduationCap className="size-4 text-emerald-600" />
                <span className="font-medium text-sm text-emerald-800">Mid-Term (CA) + Exam</span>
              </div>
              <p className="text-xs text-emerald-700">
                Two-component grading: Mid-Term Continuous Assessment and Final Exam.
                Both scores appear on report cards and contribute to the final grade.
              </p>
            </div>

            {/* Score Type Cards */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Score Components</h4>
              <div className="grid gap-2">
                {scoreTypes.map((st, index) => {
                  const colors = scoreTypeColors[st.type] || scoreTypeColors.midterm;
                  const Icon = scoreTypeIcons[st.type] || FileText;

                  return (
                    <div
                      key={`${st.type}-${index}`}
                      className={cn(
                        'rounded-lg border p-3 transition-colors',
                        colors.bg,
                        colors.border
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={cn('flex size-8 items-center justify-center rounded-md bg-white/80 shrink-0', colors.text)}>
                            <Icon className="size-4" />
                          </div>
                          <div className="min-w-0">
                            <p className={cn('text-sm font-medium truncate', colors.text)}>{st.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] text-muted-foreground">
                                Max: {st.maxMarks} marks
                              </span>
                              <span className="text-[11px] text-muted-foreground">·</span>
                              <span className="text-[11px] text-muted-foreground">
                                Weight: {st.weight}%
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Input
                            type="number"
                            value={st.maxMarks}
                            onChange={(e) => updateScoreType(index, 'maxMarks', parseInt(e.target.value) || 0)}
                            className="w-16 h-7 text-xs text-center"
                            min={0}
                          />
                          <span className="text-[11px] text-muted-foreground">/</span>
                          <Input
                            type="number"
                            value={st.weight}
                            onChange={(e) => updateScoreType(index, 'weight', parseFloat(e.target.value) || 0)}
                            className="w-16 h-7 text-xs text-center"
                            min={0}
                            step={0.5}
                          />
                          <span className="text-[11px] text-muted-foreground w-5">%</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-2 ml-[42px]">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <Switch
                            checked={st.isInReport}
                            onCheckedChange={(checked) => updateScoreType(index, 'isInReport', checked)}
                            className="scale-75"
                          />
                          <span className="text-[11px] text-muted-foreground">In Report</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <Switch
                            checked={st.isActive}
                            onCheckedChange={(checked) => updateScoreType(index, 'isActive', checked)}
                            className="scale-75"
                          />
                          <span className="text-[11px] text-muted-foreground">Active</span>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Theme & Appearance Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-violet-100">
                <Palette className="size-4.5 text-violet-600" />
              </div>
              <div>
                <CardTitle className="text-base">Theme & Appearance</CardTitle>
                <CardDescription>Customize the look and feel of your school portal</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Theme Selector */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Color Theme</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {themeOptions.map((opt) => (
                  <div
                    key={opt.id}
                    className={cn(
                      'relative flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all',
                      theme === opt.id
                        ? `${opt.borderColor} bg-white ring-2 ${opt.ringColor} ring-offset-1`
                        : 'border-muted hover:border-gray-300 bg-white'
                    )}
                    onClick={() => setTheme(opt.id)}
                  >
                    <div className={cn('size-8 rounded-md shrink-0', opt.color)} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{opt.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{opt.description}</p>
                    </div>
                    {theme === opt.id && (
                      <CheckCircle className="size-4 text-emerald-500 shrink-0 ml-auto" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Font Selector */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Type className="size-3.5" />
                Font Family
              </Label>
              <Select value={fontFamily} onValueChange={setFontFamily}>
                <SelectTrigger>
                  <SelectValue placeholder="Select font" />
                </SelectTrigger>
                <SelectContent>
                  {fontOptions.map((font) => (
                    <SelectItem key={font.value} value={font.value}>
                      <span style={font.style}>{font.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Preview: <span style={{ fontFamily: `'${fontFamily}', sans-serif` }} className="text-sm">The quick brown fox jumps over the lazy dog</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* School Info Section */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-blue-100">
                <School className="size-4.5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-base">School Information</CardTitle>
                <CardDescription>General school details and academic calendar</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              {/* School Motto */}
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="motto" className="text-sm font-medium">
                  School Motto
                </Label>
                <Textarea
                  id="motto"
                  placeholder="Enter your school motto..."
                  rows={2}
                  value={schoolMotto}
                  onChange={(e) => setSchoolMotto(e.target.value)}
                />
              </div>

              {/* School Vision */}
              <div className="space-y-2">
                <Label htmlFor="vision" className="text-sm font-medium">
                  School Vision
                </Label>
                <Textarea
                  id="vision"
                  placeholder="What is your school's vision?"
                  rows={3}
                  value={schoolVision}
                  onChange={(e) => setSchoolVision(e.target.value)}
                />
              </div>

              {/* School Mission */}
              <div className="space-y-2">
                <Label htmlFor="mission" className="text-sm font-medium">
                  School Mission
                </Label>
                <Textarea
                  id="mission"
                  placeholder="What is your school's mission?"
                  rows={3}
                  value={schoolMission}
                  onChange={(e) => setSchoolMission(e.target.value)}
                />
              </div>

              <Separator className="sm:col-span-2" />

              {/* Principal Name */}
              <div className="space-y-2">
                <Label htmlFor="principal" className="text-sm font-medium">
                  Principal Name
                </Label>
                <Input
                  id="principal"
                  placeholder="e.g. Mrs. Adewale Johnson"
                  value={principalName}
                  onChange={(e) => setPrincipalName(e.target.value)}
                />
              </div>

              {/* Vice Principal Name */}
              <div className="space-y-2">
                <Label htmlFor="vice-principal" className="text-sm font-medium">
                  Vice Principal Name
                </Label>
                <Input
                  id="vice-principal"
                  placeholder="e.g. Mr. Ibrahim Bello"
                  value={vicePrincipalName}
                  onChange={(e) => setVicePrincipalName(e.target.value)}
                />
              </div>

              <Separator className="sm:col-span-2" />

              {/* Academic Session */}
              <div className="space-y-2">
                <Label htmlFor="session" className="text-sm font-medium">
                  Academic Session
                </Label>
                <Input
                  id="session"
                  placeholder="e.g. 2025/2026"
                  value={academicSession}
                  onChange={(e) => setAcademicSession(e.target.value)}
                />
              </div>

              {/* Next Term Begins */}
              <div className="space-y-2">
                <Label htmlFor="next-term" className="text-sm font-medium">
                  Next Term Begins
                </Label>
                <Input
                  id="next-term"
                  type="date"
                  value={nextTermBegins}
                  onChange={(e) => setNextTermBegins(e.target.value)}
                />
              </div>

              <Separator className="sm:col-span-2" />

              {/* Bank Details */}
              <div className="sm:col-span-2">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <CreditCard className="size-4 text-blue-600" />
                  Bank Details (for fee payments)
                </h4>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="bankName">Bank Name</Label>
                    <Input id="bankName" placeholder="e.g. GTBank" value={bankName} onChange={(e) => setBankName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bankAccountName">Account Name</Label>
                    <Input id="bankAccountName" placeholder="e.g. Skoolar School Fees Account" value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bankAccountNumber">Account Number</Label>
                    <Input id="bankAccountNumber" placeholder="e.g. 0123456789" value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Save Bar */}
      {hasChanges && (
        <div className="sticky bottom-0 z-10 flex items-center justify-between rounded-lg border bg-background/95 backdrop-blur p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="size-4 text-amber-500" />
            <span>You have unsaved changes</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Reset to saved values
                if (settings) {
                  setScoreSystem(settings.scoreSystem || 'midterm_exam');
                  setFontFamily(settings.fontFamily || 'Inter');
                  setTheme(settings.theme || 'default');
                  setSchoolMotto(settings.schoolMotto || '');
                  setSchoolVision(settings.schoolVision || '');
                  setSchoolMission(settings.schoolMission || '');
                  setPrincipalName(settings.principalName || '');
                  setVicePrincipalName(settings.vicePrincipalName || '');
                  setAcademicSession(settings.academicSession || '');
                  setNextTermBegins(settings.nextTermBegins ? settings.nextTermBegins.split('T')[0] : '');
                }
                setBankName('');
                setBankAccountName('');
                setBankAccountNumber('');
              }}
            >
              Discard
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="gap-2"
            >
              {saving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
              Save Changes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
