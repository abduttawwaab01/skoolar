'use client';

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import {
  Sparkles, Calendar, Loader2, CheckCircle2, AlertTriangle,
  Clock, MapPin, Users, BookText, Save, Eye, RotateCcw,
} from 'lucide-react';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface ClassInfo { id: string; name: string; grade: string | null; }
interface SubjectInfo { id: string; name: string; code: string | null; }
interface TeacherInfo { id: string; name: string; }

interface GeneratedSlot {
  dayOfWeek: number;
  period: number;
  startTime: string;
  endTime: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  room: string;
  isBreak?: boolean;
}

interface GeneratedTimetable {
  timetable: GeneratedSlot[];
  conflictsResolved: number;
  notes: string;
}

export function AITimetableGenerator() {
  const [academicYearId, setAcademicYearId] = useState('');
  const [termId, setTermId] = useState('');
  const [name, setName] = useState('');
  const [periodsPerDay, setPeriodsPerDay] = useState('8');
  const [periodMinutes, setPeriodMinutes] = useState('40');
  const [startHour, setStartHour] = useState('8');
  const [schoolDays, setSchoolDays] = useState('5');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<GeneratedTimetable | null>(null);
  const [selectedResultDay, setSelectedResultDay] = useState(1);
  const [saveTargetTimetableId, setSaveTargetTimetableId] = useState('');

  const currentRole = useAppStore(s => s.currentRole);
  const selectedSchoolId = useAppStore(s => s.selectedSchoolId);
  const schoolId = useAppStore(s => s.currentUser.schoolId);
  const queryClient = useQueryClient();

  const effectiveSchoolId = currentRole === 'SUPER_ADMIN' ? selectedSchoolId : schoolId;

  const { data: academicYears } = useQuery({
    queryKey: ['academic-years', effectiveSchoolId],
    queryFn: () => fetch(`/api/academic-years?schoolId=${effectiveSchoolId}`).then(r => r.json()),
    enabled: !!effectiveSchoolId,
  });

  useEffect(() => {
    if (academicYears?.data?.length > 0 && !academicYearId) {
      setAcademicYearId(academicYears.data[0].id);
    }
  }, [academicYears, academicYearId]);

  const { data: terms } = useQuery({
    queryKey: ['terms', effectiveSchoolId],
    queryFn: () => fetch(`/api/terms?schoolId=${effectiveSchoolId}`).then(r => r.json()),
    enabled: !!effectiveSchoolId,
  });

  const { data: classes } = useQuery({
    queryKey: ['classes', effectiveSchoolId],
    queryFn: () => fetch(`/api/classes?schoolId=${effectiveSchoolId}`).then(r => r.json()),
    enabled: !!effectiveSchoolId,
  });

  const { data: subjects } = useQuery({
    queryKey: ['subjects', effectiveSchoolId],
    queryFn: () => fetch(`/api/subjects?schoolId=${effectiveSchoolId}`).then(r => r.json()),
    enabled: !!effectiveSchoolId,
  });

  const { data: teachers } = useQuery({
    queryKey: ['teachers', effectiveSchoolId],
    queryFn: () => fetch(`/api/teachers?schoolId=${effectiveSchoolId}`).then(r => r.json()),
    enabled: !!effectiveSchoolId,
  });

  const { data: timetables } = useQuery({
    queryKey: ['timetables', effectiveSchoolId],
    queryFn: () => fetch(`/api/timetable?schoolId=${effectiveSchoolId}&limit=100`).then(r => r.json()),
    enabled: !!effectiveSchoolId,
  });

  const handleGenerate = useCallback(async () => {
    if (!academicYearId || !name.trim()) {
      toast.error('Academic year and timetable name are required');
      return;
    }

    setIsGenerating(true);
    setProgress(10);
    setResult(null);

    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + Math.random() * 15, 85));
    }, 500);

    try {
      const response = await fetch('/api/ai/timetable/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: effectiveSchoolId,
          academicYearId,
          termId: termId && termId !== 'all' ? termId : undefined,
          name: name.trim(),
          availablePeriodsPerDay: parseInt(periodsPerDay) || 8,
          periodDurationMinutes: parseInt(periodMinutes) || 40,
          startHour: parseInt(startHour) || 8,
          daysInWeek: parseInt(schoolDays) || 5,
        }),
      });

      clearInterval(progressInterval);
      setProgress(95);

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Generation failed');
      }

      const data = await response.json();
      setProgress(100);

      setTimeout(() => {
        setResult(data.data);
        setIsGenerating(false);
        setProgress(0);
        toast.success(`Timetable generated: ${data.data.timetable.length} slots`);
      }, 300);
    } catch (error: unknown) {
      clearInterval(progressInterval);
      setIsGenerating(false);
      setProgress(0);
      toast.error(error instanceof Error ? error.message : 'Failed to generate timetable');
    }
  }, [academicYearId, termId, name, periodsPerDay, periodMinutes, startHour, schoolDays, effectiveSchoolId]);

  const handleSaveAsTimetable = useCallback(async () => {
    if (!result || !result.timetable.length) return;

    try {
      const response = await fetch('/api/timetable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: effectiveSchoolId,
          academicYearId,
          termId: termId || undefined,
          name: `${name.trim()} (AI Generated)`,
          description: `AI-generated timetable. ${result.notes}`,
          slots: result.timetable.map(s => ({
            dayOfWeek: s.dayOfWeek,
            period: s.period,
            startTime: s.startTime,
            endTime: s.endTime,
            classId: s.classId,
            subjectId: s.subjectId,
            teacherId: s.teacherId || null,
            room: s.room || null,
            isBreak: s.isBreak || false,
          })),
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Save failed');
      }

      toast.success('Timetable saved successfully!');
      queryClient.invalidateQueries({ queryKey: ['timetables'] });
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to save timetable');
    }
  }, [result, name, academicYearId, termId, effectiveSchoolId, queryClient]);

  const classList: ClassInfo[] = classes?.data || classes || [];
  const subjectList: SubjectInfo[] = subjects?.data || subjects || [];
  const teacherList: TeacherInfo[] = teachers?.data?.data || teachers?.data || teachers || [];
  const termList: Array<{ id: string; name: string; academicYear?: { name: string } }> = terms?.data || terms || [];
  const timetableList: Array<{ id: string; name: string }> = timetables?.data || timetables || [];

  const getClassName = (id: string) => classList.find((c: ClassInfo) => c.id === id)?.name || id;
  const getSubjectName = (id: string) => subjectList.find((s: SubjectInfo) => s.id === id)?.name || id;
  const getTeacherName = (id: string) => {
    const t = teacherList.find((t: TeacherInfo) => t.id === id);
    return t?.name || id;
  };

  const daysWithSlots = Array.from(new Set(result?.timetable.map(s => s.dayOfWeek) || [])).sort();
  const filteredSlots = result?.timetable.filter(s => s.dayOfWeek === selectedResultDay)
    ?.sort((a, b) => a.period - b.period) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-100">
            <Sparkles className="h-6 w-6 text-indigo-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">AI Timetable Generator</h2>
            <p className="text-sm text-gray-500">Generate optimized, conflict-free timetables with AI</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-indigo-500" />
                Schedule Settings
              </CardTitle>
              <CardDescription>Configure the timetable parameters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Academic Year</Label>
                <Select value={academicYearId} onValueChange={setAcademicYearId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {(academicYears?.data || academicYears || []).map((ay: { id: string; name: string }) => (
                      <SelectItem key={ay.id} value={ay.id}>{ay.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium">Term (optional)</Label>
                <Select value={termId} onValueChange={setTermId}>
                  <SelectTrigger>
                    <SelectValue placeholder="All terms" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Terms</SelectItem>
                    {termList.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium">Timetable Name</Label>
                <Input
                  placeholder="e.g., Term 1 Weekly Schedule"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">Periods/Day</Label>
                  <Input type="number" min={4} max={12} value={periodsPerDay} onChange={e => setPeriodsPerDay(e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm font-medium">Minutes/Period</Label>
                  <Input type="number" min={20} max={120} value={periodMinutes} onChange={e => setPeriodMinutes(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">Start Hour</Label>
                  <Input type="number" min={6} max={10} value={startHour} onChange={e => setStartHour(e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm font-medium">School Days</Label>
                  <Input type="number" min={3} max={7} value={schoolDays} onChange={e => setSchoolDays(e.target.value)} />
                </div>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !name.trim() || !academicYearId}
                className="w-full gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate with AI
                  </>
                )}
              </Button>

              {isGenerating && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">AI is building your timetable...</span>
                    <span className="font-medium">{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-100">
            <CardContent className="pt-5">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-5 w-5 text-indigo-600 mt-0.5 shrink-0" />
                <div className="text-xs text-indigo-800 space-y-1.5">
                  <p className="font-semibold">How it works</p>
                  <ul className="list-disc list-inside space-y-1 text-indigo-700">
                    <li>AI analyzes your school structure</li>
                    <li>Generates conflict-free schedules</li>
                    <li>Distributes subjects evenly</li>
                    <li>Review and save as needed</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {!result ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center p-8">
              <div className="p-4 rounded-full bg-indigo-100 mb-4">
                <Calendar className="h-12 w-12 text-indigo-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Timetable Generated Yet</h3>
              <p className="text-sm text-gray-500 max-w-md">
                Configure your parameters on the left and click &quot;Generate with AI&quot; to create an optimized timetable.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        Generated Timetable
                      </CardTitle>
                      <CardDescription>
                        {result.timetable.length} slots · {result.conflictsResolved} conflicts resolved
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleSaveAsTimetable} className="gap-2">
                        <Save className="h-4 w-4" />
                        Save
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setResult(null)} className="gap-2">
                        <RotateCcw className="h-4 w-4" />
                        Reset
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              <div className="flex gap-2 flex-wrap">
                {daysWithSlots.map(day => (
                  <Button
                    key={day}
                    variant={selectedResultDay === day ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedResultDay(day)}
                  >
                    {WEEKDAYS[day]}
                  </Button>
                ))}
              </div>

              <Card>
                <ScrollArea className="h-[500px]">
                  <CardContent className="p-4 space-y-2">
                    {filteredSlots.map((slot, i) => (
                      <div key={i} className="flex items-center gap-4 p-3 rounded-lg border hover:bg-gray-50 transition-colors">
                        <div className="flex flex-col items-center justify-center w-14 h-14 rounded-lg bg-indigo-50 text-indigo-700 shrink-0">
                          <span className="text-xs font-medium">Period</span>
                          <span className="text-lg font-bold">{slot.period}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="secondary" className="font-medium">
                              {getSubjectName(slot.subjectId)}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {getClassName(slot.classId)}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {slot.startTime} - {slot.endTime}
                            </span>
                            {slot.teacherId && (
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {getTeacherName(slot.teacherId)}
                              </span>
                            )}
                            {slot.room && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {slot.room}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {filteredSlots.length === 0 && (
                      <p className="text-center text-gray-400 py-8">No slots for this day</p>
                    )}
                  </CardContent>
                </ScrollArea>
              </Card>

              {result.notes && (
                <Card className="bg-amber-50 border-amber-200">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <p className="text-sm text-amber-800">{result.notes}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
