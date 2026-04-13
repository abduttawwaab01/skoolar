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
import {
  RadioGroup,
  RadioGroupItem,
} from '@/components/ui/radio-group';
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
  Info,
  X,
  CreditCard,
  Users,
  GraduationCap,
  Loader2,
  Plus,
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
  gradingScale: string | null;
  createdAt: string;
  updatedAt: string;
}

interface GradeEntry {
  grade: string;
  minScore: number;
  maxScore: number;
  gpa: number;
  description: string;
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

const defaultScoreTypes: Record<string, ScoreTypeData[]> = {
  midterm_exam: [
    { id: 'st-midterm', schoolId: '', name: 'Mid-Term (CA)', type: 'midterm', maxMarks: 40, weight: 40, position: 0, isInReport: true, isActive: true },
    { id: 'st-exam', schoolId: '', name: 'Exam', type: 'exam', maxMarks: 60, weight: 60, position: 1, isInReport: true, isActive: true },
  ],
  daily_weekly_midterm_exam: [
    { id: 'st-daily', schoolId: '', name: 'Daily Test', type: 'daily', maxMarks: 10, weight: 10, position: 0, isInReport: false, isActive: true },
    { id: 'st-weekly', schoolId: '', name: 'Weekly Test (Friday)', type: 'weekly', maxMarks: 20, weight: 20, position: 1, isInReport: false, isActive: true },
    { id: 'st-midterm', schoolId: '', name: 'Mid-Term (CA)', type: 'midterm', maxMarks: 40, weight: 40, position: 2, isInReport: true, isActive: true },
    { id: 'st-exam', schoolId: '', name: 'Exam', type: 'exam', maxMarks: 60, weight: 60, position: 3, isInReport: true, isActive: true },
  ],
};

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

const defaultGradingScale: GradeEntry[] = [
  { grade: 'A', minScore: 70, maxScore: 100, gpa: 5.0, description: 'Excellent' },
  { grade: 'B', minScore: 60, maxScore: 69, gpa: 4.0, description: 'Very Good' },
  { grade: 'C', minScore: 50, maxScore: 59, gpa: 3.0, description: 'Good' },
  { grade: 'D', minScore: 45, maxScore: 49, gpa: 2.0, description: 'Pass' },
  { grade: 'E', minScore: 40, maxScore: 44, gpa: 1.0, description: 'Fair' },
  { grade: 'F', minScore: 0, maxScore: 39, gpa: 0.0, description: 'Fail' },
];

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
  const [gradingScale, setGradingScale] = React.useState<GradeEntry[]>(defaultGradingScale);

  // Fetch settings
  React.useEffect(() => {
    async function fetchSettings() {
      if (!schoolId) return;
      try {
        setLoading(true);

        const [settingsRes, scoreTypesRes] = await Promise.all([
          fetch(`/api/school-settings?schoolId=${schoolId}`),
          fetch(`/api/score-types?schoolId=${schoolId}`),
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
            
            if (s.gradingScale) {
              try {
                setGradingScale(JSON.parse(s.gradingScale));
              } catch {
                setGradingScale(defaultGradingScale);
              }
            } else {
              setGradingScale(defaultGradingScale);
            }
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
            setScoreTypes(defaultScoreTypes.midterm_exam.map((st) => ({ ...st, schoolId })));
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

  // Update score types when system changes
  const handleScoreSystemChange = (value: string) => {
    setScoreSystem(value);
    const defaults = defaultScoreTypes[value];
    if (defaults) {
      setScoreTypes(defaults.map((st) => ({ ...st, schoolId })));
    }
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
          gradingScale: JSON.stringify(gradingScale),
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
      JSON.stringify(gradingScale) !== (settings.gradingScale || JSON.stringify(defaultGradingScale))
    );
  }, [settings, scoreSystem, fontFamily, theme, schoolMotto, schoolVision, schoolMission, principalName, vicePrincipalName, academicSession, nextTermBegins, gradingScale]);

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
          className="gap-2 min-w-[140px]"
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
            <RadioGroup
              value={scoreSystem}
              onValueChange={handleScoreSystemChange}
              className="space-y-3"
            >
              {/* Mid-Term + Exam Only */}
              <div
                className={cn(
                  'flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors',
                  scoreSystem === 'midterm_exam'
                    ? 'border-emerald-300 bg-emerald-50/50 ring-1 ring-emerald-200'
                    : 'border-muted hover:border-emerald-200 hover:bg-muted/50'
                )}
                onClick={() => handleScoreSystemChange('midterm_exam')}
              >
                <RadioGroupItem value="midterm_exam" id="midterm_exam" className="mt-0.5" />
                <Label htmlFor="midterm_exam" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">Mid-Term (CA) + Exam Only</span>
                    <Badge variant="outline" className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200">Recommended</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Traditional 2-component grading: Continuous Assessment (40%) and Final Exam (60%).
                    Only Mid-Term and Exam appear on report cards.
                  </p>
                </Label>
              </div>

              {/* Daily + Weekly + Mid-Term + Exam */}
              <div
                className={cn(
                  'flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors',
                  scoreSystem === 'daily_weekly_midterm_exam'
                    ? 'border-emerald-300 bg-emerald-50/50 ring-1 ring-emerald-200'
                    : 'border-muted hover:border-emerald-200 hover:bg-muted/50'
                )}
                onClick={() => handleScoreSystemChange('daily_weekly_midterm_exam')}
              >
                <RadioGroupItem value="daily_weekly_midterm_exam" id="daily_weekly_midterm_exam" className="mt-0.5" />
                <Label htmlFor="daily_weekly_midterm_exam" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">Daily + Weekly + Mid-Term (CA) + Exam</span>
                    <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">Advanced</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    4-component grading with daily tests, weekly tests, midterm assessment, and final exam.
                    All components contribute to the final score.
                  </p>
                </Label>
              </div>
            </RadioGroup>

            <Separator />

            {/* Note */}
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
              <Info className="size-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                <strong>Note:</strong> Only Mid-Term and Exam scores appear on report cards. Daily and Weekly tests are tracked internally for continuous assessment.
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
              <div className="grid grid-cols-2 gap-3">
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
              <p className="text-[11px] text-muted-foreground mt-2">
                Preview: <span style={{ fontFamily: `'${fontFamily}', sans-serif` }} className="text-sm">The quick brown fox jumps over the lazy dog</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Grading Scale Section */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-amber-100">
                <Star className="size-4.5 text-amber-600" />
              </div>
              <div>
                <CardTitle className="text-base">Grading Scale</CardTitle>
                <CardDescription>Define score ranges and grade points (GPA)</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-hidden bg-white">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Grade</th>
                    <th className="px-4 py-2 text-left font-medium">Range (Min - Max)</th>
                    <th className="px-4 py-2 text-left font-medium">GPA Point</th>
                    <th className="px-4 py-2 text-left font-medium">Description</th>
                    <th className="px-4 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {gradingScale.map((entry, idx) => (
                    <tr key={idx} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2">
                        <Input 
                          value={entry.grade} 
                          onChange={(e) => {
                            const newScale = [...gradingScale];
                            newScale[idx].grade = e.target.value.toUpperCase();
                            setGradingScale(newScale);
                          }}
                          className="w-16 h-8 text-center font-bold"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <Input 
                            type="number"
                            value={entry.minScore} 
                            onChange={(e) => {
                              const newScale = [...gradingScale];
                              newScale[idx].minScore = parseInt(e.target.value) || 0;
                              setGradingScale(newScale);
                            }}
                            className="w-16 h-8 text-center"
                          />
                          <span className="text-muted-foreground">-</span>
                          <Input 
                            type="number"
                            value={entry.maxScore} 
                            onChange={(e) => {
                              const newScale = [...gradingScale];
                              newScale[idx].maxScore = parseInt(e.target.value) || 0;
                              setGradingScale(newScale);
                            }}
                            className="w-16 h-8 text-center"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <Input 
                          type="number"
                          step="0.1"
                          value={entry.gpa} 
                          onChange={(e) => {
                            const newScale = [...gradingScale];
                            newScale[idx].gpa = parseFloat(e.target.value) || 0;
                            setGradingScale(newScale);
                          }}
                          className="w-16 h-8 text-center"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Input 
                          value={entry.description} 
                          onChange={(e) => {
                            const newScale = [...gradingScale];
                            newScale[idx].description = e.target.value;
                            setGradingScale(newScale);
                          }}
                          className="h-8"
                          placeholder="e.g. Excellent"
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="size-8 text-muted-foreground hover:text-red-600"
                          onClick={() => setGradingScale(gradingScale.filter((_, i) => i !== idx))}
                        >
                          <X className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-between items-center">
              <p className="text-xs text-muted-foreground italic">
                * Changes here will affect how grades are calculated across the entire dashboard.
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                onClick={() => setGradingScale([...gradingScale, { grade: 'NEW', minScore: 0, maxScore: 0, gpa: 0, description: '' }])}
              >
                <Plus className="size-4" />
                Add Grade Level
              </Button>
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
