'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Save, X, Plus, Clock, Users, BookOpen, MapPin, Loader2, ArrowLeft } from 'lucide-react';

interface TimetableBuilderProps {
  schoolId: string;
  timetables: any[];
  classes: any[];
  subjects: any[];
  teachers: any[];
  academicYears: any[];
  terms: any[];
  onSaved: () => void;
  onCancel: () => void;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DEFAULT_PERIODS = [
  { period: 1, startTime: '08:00', endTime: '08:40' },
  { period: 2, startTime: '08:40', endTime: '09:20' },
  { period: 3, startTime: '09:20', endTime: '10:00' },
  { period: 4, startTime: '10:00', endTime: '10:40' },
  { period: 5, startTime: '10:40', endTime: '11:20' },
  { period: 6, startTime: '11:20', endTime: '12:00' },
  { period: 7, startTime: '12:00', endTime: '12:40' },
  { period: 8, startTime: '12:40', endTime: '13:20' },
  { period: 9, startTime: '13:20', endTime: '14:00' },
  { period: 10, startTime: '14:00', endTime: '14:40' },
];

export function TimetableBuilder({
  schoolId, timetables, classes, subjects, teachers, academicYears, terms, onSaved, onCancel
}: TimetableBuilderProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Timetable Selection State
  const [selectedTimetableId, setSelectedTimetableId] = useState<string>('new');
  const [newTimetableName, setNewTimetableName] = useState('');
  const [newAcademicYearId, setNewAcademicYearId] = useState(academicYears[0]?.id || '');

  // UI Selection State
  const [activeClass, setActiveClass] = useState(classes[0]?.id || '');
  const [activeDay, setActiveDay] = useState(1);
  const [activeTermId, setActiveTermId] = useState(terms[0]?.id || '');

  // Master Slots State (All classes, all days)
  const [allSlots, setAllSlots] = useState<any[]>([]);

  // Fetch slots when an existing timetable is selected
  useEffect(() => {
    if (selectedTimetableId === 'new') {
      setAllSlots([]);
      setNewTimetableName('');
      return;
    }

    const tt = timetables.find(t => t.id === selectedTimetableId);
    if (tt) {
      setNewTimetableName(tt.name);
      setNewAcademicYearId(tt.academicYearId || academicYears[0]?.id || '');
    }

    const fetchExistingSlots = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/timetable/${selectedTimetableId}`);
        if (!res.ok) throw new Error('Failed to fetch slots');
        const json = await res.json();
        if (json.slots) {
          setAllSlots(json.slots);
        }
      } catch (err) {
        toast.error('Could not load slots for this timetable.');
      } finally {
        setLoading(false);
      }
    };

    fetchExistingSlots();
  }, [selectedTimetableId, timetables, academicYears]);

  // Derived state: slots for the current active view (Class + Day)
  const currentViewSlots = useMemo(() => {
    const viewSlots = DEFAULT_PERIODS.map(dp => {
      const existing = allSlots.find(
        s => s.classId === activeClass && s.dayOfWeek === activeDay && s.period === dp.period
      );
      if (existing) return existing;
      return {
        id: `temp_${Date.now()}_${dp.period}`,
        classId: activeClass,
        dayOfWeek: activeDay,
        period: dp.period,
        startTime: dp.startTime,
        endTime: dp.endTime,
        subjectId: '',
        teacherId: '',
        room: '',
        isBreak: false,
        termId: activeTermId,
      };
    });
    return viewSlots;
  }, [allSlots, activeClass, activeDay, activeTermId]);

  const handleSlotChange = (period: number, field: string, value: any) => {
    setAllSlots(prev => {
      const clone = [...prev];
      const existingIndex = clone.findIndex(
        s => s.classId === activeClass && s.dayOfWeek === activeDay && s.period === period
      );

      if (existingIndex >= 0) {
        clone[existingIndex] = { ...clone[existingIndex], [field]: value };
        // If subject is cleared and it's not a break, we might want to remove it entirely on save
      } else {
        // Find the default period info
        const dp = DEFAULT_PERIODS.find(d => d.period === period);
        if (!dp) return clone;

        clone.push({
          classId: activeClass,
          dayOfWeek: activeDay,
          period: dp.period,
          startTime: dp.startTime,
          endTime: dp.endTime,
          subjectId: '',
          teacherId: '',
          room: '',
          isBreak: false,
          termId: activeTermId,
          [field]: value
        });
      }
      return clone;
    });
  };

  const handleSave = async () => {
    if (selectedTimetableId === 'new' && !newTimetableName.trim()) {
      toast.error('Please provide a name for the new timetable.');
      return;
    }

    // Filter out completely empty slots (not breaks, and no subject)
    const validSlots = allSlots.filter(s => s.isBreak || s.subjectId);

    setSaving(true);
    try {
      if (selectedTimetableId === 'new') {
        const payload = {
          schoolId,
          academicYearId: newAcademicYearId,
          name: newTimetableName,
          isPublished: true,
          slots: validSlots,
        };
        const res = await fetch('/api/timetable', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await res.text());
        toast.success('Timetable created successfully!');
      } else {
        const res = await fetch(`/api/timetable/${selectedTimetableId}/slots`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            timetableId: selectedTimetableId,
            slots: validSlots,
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        toast.success('Timetable updated successfully!');
      }
      onSaved();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to save timetable.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <ArrowLeft className="size-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Timetable Builder</h1>
            <p className="text-muted-foreground">Construct and manage schedules</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
            <Save className="mr-2 size-4" /> Save Entire Timetable
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column: Settings & Navigation */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">General Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Action</Label>
                <Select value={selectedTimetableId} onValueChange={setSelectedTimetableId}>
                  <SelectTrigger><SelectValue placeholder="Action" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new" className="font-bold text-primary">
                      + Create New Timetable
                    </SelectItem>
                    {timetables.map(t => (
                      <SelectItem key={t.id} value={t.id}>Edit: {t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedTimetableId === 'new' && (
                <>
                  <div className="space-y-2">
                    <Label>Timetable Name</Label>
                    <Input 
                      placeholder="e.g. Fall 2026 Schedule" 
                      value={newTimetableName} 
                      onChange={e => setNewTimetableName(e.target.value)} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Academic Year</Label>
                    <Select value={newAcademicYearId} onValueChange={setNewAcademicYearId}>
                      <SelectTrigger><SelectValue placeholder="Select Year" /></SelectTrigger>
                      <SelectContent>
                        {academicYears.map(y => (
                          <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label>Term (For Slots)</Label>
                <Select value={activeTermId} onValueChange={setActiveTermId}>
                  <SelectTrigger><SelectValue placeholder="Select Term" /></SelectTrigger>
                  <SelectContent>
                    {terms.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Editor View</CardTitle>
              <CardDescription>Select the Class and Day you want to edit right now.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Editing Class</Label>
                <Select value={activeClass} onValueChange={setActiveClass}>
                  <SelectTrigger><SelectValue placeholder="Select Class" /></SelectTrigger>
                  <SelectContent>
                    {classes.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Editing Day</Label>
                <Select value={String(activeDay)} onValueChange={(v) => setActiveDay(Number(v))}>
                  <SelectTrigger><SelectValue placeholder="Select Day" /></SelectTrigger>
                  <SelectContent>
                    {DAYS.filter((_, i) => i >= 1 && i <= 5).map((d, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Grid Editor */}
        <div className="md:col-span-2">
          <Card className="h-full">
            <CardHeader className="border-b bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>
                    {classes.find(c => c.id === activeClass)?.name || 'Class'} • {DAYS[activeDay]}
                  </CardTitle>
                  <CardDescription>
                    Fill in the periods. Changes are held locally until you click Save Entire Timetable.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="bg-primary/5 text-primary">
                  {allSlots.filter(s => s.classId === activeClass && s.dayOfWeek === activeDay && (s.isBreak || s.subjectId)).length} Slots Set
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center p-12 text-muted-foreground">
                  <Loader2 className="size-6 animate-spin mr-2" /> Loading slots...
                </div>
              ) : (
                <div className="divide-y">
                  {currentViewSlots.map((slot) => (
                    <div key={slot.period} className={`p-4 transition-colors ${slot.isBreak ? 'bg-amber-50/50' : 'hover:bg-muted/30'}`}>
                      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                        
                        <div className="w-28 shrink-0">
                          <div className="font-bold text-sm">Period {slot.period}</div>
                          <div className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded w-max mt-1">
                            {slot.startTime} - {slot.endTime}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 border-r pr-4">
                          <Switch 
                            checked={slot.isBreak}
                            onCheckedChange={(val) => handleSlotChange(slot.period, 'isBreak', val)}
                          />
                          <Label className="text-xs font-medium cursor-pointer" onClick={() => handleSlotChange(slot.period, 'isBreak', !slot.isBreak)}>Break?</Label>
                        </div>

                        {slot.isBreak ? (
                          <div className="flex-1 italic text-amber-700 text-sm">
                            This period is marked as a break or assembly.
                          </div>
                        ) : (
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
                            <div className="space-y-1">
                              <Select value={slot.subjectId || ''} onValueChange={(val) => handleSlotChange(slot.period, 'subjectId', val)}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Subject" /></SelectTrigger>
                                <SelectContent>
                                  {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Select value={slot.teacherId || ''} onValueChange={(val) => handleSlotChange(slot.period, 'teacherId', val)}>
                                <SelectTrigger className="h-8 text-xs max-w-full"><SelectValue placeholder="Teacher" className="truncate" /></SelectTrigger>
                                <SelectContent className="min-w-0 max-w-[250px]">
                                  {teachers.map(t => <SelectItem key={t.id} value={t.id} className="truncate">{t.user.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1 relative">
                              <MapPin className="absolute left-2.5 top-2 size-3 text-muted-foreground" />
                              <Input 
                                placeholder="Room (opt)" 
                                className="h-8 pl-8 text-xs" 
                                value={slot.room || ''}
                                onChange={(e) => handleSlotChange(slot.period, 'room', e.target.value)}
                              />
                            </div>
                          </div>
                        )}
                        
                        {!slot.isBreak && slot.subjectId && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => handleSlotChange(slot.period, 'subjectId', '')}>
                            <X className="size-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
