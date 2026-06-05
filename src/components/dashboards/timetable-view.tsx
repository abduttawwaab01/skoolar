'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { TimetableBuilder } from './timetable-builder';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from '@/components/ui/tooltip';
import { 
  Clock, Calendar, BookOpen, Users, MapPin, Plus, Save, Trash2,
  ChevronLeft, ChevronRight, Download, Upload, BookText, Target
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SchemeEntryInfo {
  id: string;
  weekNumber: number;
  topic: string;
  subTopic: string | null;
  learningObjectives: string | null;
  status: string;
  schemeOfWork: {
    id: string;
    subjectId: string;
    classId: string;
  };
}

interface TimetableSlot {
  id: string;
  dayOfWeek: number;
  period: number;
  startTime: string;
  endTime: string;
  classId: string;
  subjectId: string;
  teacherId: string | null;
  room: string | null;
  isBreak: boolean;
  schemeOfWorkEntry: SchemeEntryInfo | null;
}

interface ClassInfo {
  id: string;
  name: string;
  section: string | null;
  grade: string | null;
}

interface SubjectInfo {
  id: string;
  name: string;
  code: string | null;
}

interface TeacherInfo {
  id: string;
  user: { name: string };
}

interface TimetableInfo {
  id: string;
  name: string;
  isActive: boolean;
  isPublished: boolean;
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

export function TimetableView() {
  const { currentUser, selectedSchoolId, currentRole } = useAppStore();
  const schoolId = currentUser.schoolId || selectedSchoolId || '';

  const [timetables, setTimetables] = useState<TimetableInfo[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [subjects, setSubjects] = useState<SubjectInfo[]>([]);
  const [teachers, setTeachers] = useState<TeacherInfo[]>([]);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<{ teacherId?: string; studentId?: string; classId?: string } | null>(null);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);

  const [selectedTimetable, setSelectedTimetable] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'view' | 'edit'>('view');

  useEffect(() => {
    fetchTimetable();
  }, [schoolId, selectedClass]);

  const fetchTimetable = async () => {
    if (!schoolId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/timetable?schoolId=${schoolId}`);
      if (!res.ok) throw new Error('Failed to load timetables');
      const json = await res.json();
      
      setTimetables(json.data || []);
      setClasses(json.classes || []);
      setSubjects(json.subjects || []);
      setTeachers(json.teachers || []);
      setAcademicYears(json.academicYears || []);
      setTerms(json.terms || []);
      
      if (json.data?.length > 0 && !selectedTimetable) {
        setSelectedTimetable(json.data[0].id);
      }
      
      setUserProfile(json.userProfile || null);
      if (currentRole === 'STUDENT' && json.userProfile?.classId) {
        setSelectedClass(json.userProfile.classId);
      } else if (json.classes?.length > 0 && !selectedClass) {
        setSelectedClass(json.classes[0].id);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load timetable data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTimetable) {
      fetchSlots();
    }
  }, [selectedTimetable]);

  const fetchSlots = async () => {
    if (!selectedTimetable) return;
    try {
      const res = await fetch(`/api/timetable/${selectedTimetable}`);
      if (!res.ok) return;
      const json = await res.json();
      setSlots(json.slots || []);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredSlots = useMemo(() => {
    let filtered = slots;
    
    if (currentRole === 'TEACHER' && userProfile?.teacherId) {
      filtered = filtered.filter(s => s.teacherId === userProfile.teacherId);
    } else if (selectedClass) {
      filtered = filtered.filter(s => s.classId === selectedClass);
    }
    
    filtered = filtered.filter(s => s.dayOfWeek === selectedDay);
    filtered.sort((a, b) => a.period - b.period);
    
    return filtered;
  }, [slots, selectedClass, selectedDay, currentRole, userProfile]);

  const getSubjectName = (subjectId: string) => {
    const subject = subjects.find(s => s.id === subjectId);
    return subject?.name || '—';
  };

  const getTeacherName = (teacherId: string | null) => {
    if (!teacherId) return null;
    const teacher = teachers.find(t => t.id === teacherId);
    return teacher?.user.name || null;
  };

  const getClassName = (classId: string) => {
    const cls = classes.find(c => c.id === classId);
    return cls?.name || '—';
  };

  const isAdmin = currentRole === 'SCHOOL_ADMIN' || currentRole === 'SUPER_ADMIN' || currentRole === 'DIRECTOR';
  const isTeacher = currentRole === 'TEACHER';

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Timetable</h1>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
        <div className="grid gap-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (viewMode === 'edit') {
    return (
      <TimetableBuilder
        schoolId={schoolId}
        timetables={timetables}
        classes={classes}
        subjects={subjects}
        teachers={teachers}
        academicYears={academicYears}
        terms={terms}
        onSaved={() => {
          setViewMode('view');
          fetchTimetable();
        }}
        onCancel={() => setViewMode('view')}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Timetable</h1>
          <p className="text-muted-foreground">
            {isTeacher ? 'Your teaching schedule' : 'Class schedules and periods'}
          </p>
        </div>
        
        {isAdmin && (
          <Button variant="outline" onClick={() => setViewMode(viewMode === 'view' ? 'edit' : 'view')}>
            {viewMode === 'view' ? 'Edit Timetable' : 'View Only'}
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Timetable</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedTimetable} onValueChange={setSelectedTimetable}>
              <SelectTrigger><SelectValue placeholder="Select timetable" /></SelectTrigger>
              <SelectContent>
                {timetables.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {timetables.length === 0 && (
              <p className="text-xs text-muted-foreground mt-2">No timetables available</p>
            )}
          </CardContent>
        </Card>

        {currentRole !== 'STUDENT' && currentRole !== 'TEACHER' && (
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Class</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>
                {classes.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Day</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={String(selectedDay)} onValueChange={(v) => setSelectedDay(Number(v))}>
              <SelectTrigger><SelectValue placeholder="Select day" /></SelectTrigger>
              <SelectContent>
                {DAYS.filter((_, i) => i >= 1 && i <= 6).map((day, i) => (
                  <SelectItem key={i} value={String(i)}>{day}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Periods</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredSlots.length}</div>
            <p className="text-xs text-muted-foreground">classes scheduled</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="size-5" />
            {DAYS[selectedDay]} Schedule
          </CardTitle>
          <CardDescription>
            {selectedClass ? getClassName(selectedClass) : 'All classes'} • {timetables.find(t => t.id === selectedTimetable)?.name || 'Select a timetable'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredSlots.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="size-12 mx-auto text-gray-300 mb-4" />
              <p className="text-muted-foreground">No classes scheduled for this day</p>
              {isAdmin && (
                <Button className="mt-4" variant="outline" onClick={() => setViewMode('edit')}>
                  <Plus className="size-4 mr-2" /> Create Timetable
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSlots.map((slot, index) => (
                <div
                  key={slot.id || index}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-xl border transition-all",
                    slot.isBreak ? "bg-amber-50 border-amber-200" : "bg-white border-gray-100 hover:border-gray-200"
                  )}
                >
                  <div className="w-16 text-center shrink-0">
                    <div className="text-lg font-bold">P{slot.period}</div>
                    <div className="text-xs text-muted-foreground">
                      {slot.startTime}-{slot.endTime}
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    {slot.isBreak ? (
                      <div className="font-medium text-amber-700">Break / Assembly</div>
                    ) : (
                      <>
                        <div className="font-bold text-gray-900">{getSubjectName(slot.subjectId)}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-3">
                          {slot.room && (
                            <span className="flex items-center gap-1">
                              <MapPin className="size-3" /> {slot.room}
                            </span>
                          )}
                          {slot.teacherId && (
                            <span className="flex items-center gap-1">
                              <Users className="size-3" /> {getTeacherName(slot.teacherId)}
                            </span>
                          )}
                        </div>
                        {slot.schemeOfWorkEntry && slot.schemeOfWorkEntry.topic && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1.5 mt-1 text-xs text-purple-600 cursor-help">
                                  <BookText className="size-3" />
                                  <span className="line-clamp-1">{slot.schemeOfWorkEntry.topic}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-xs">
                                <div className="space-y-1.5 text-xs">
                                  <p className="font-semibold text-purple-700">Week {slot.schemeOfWorkEntry.weekNumber}: {slot.schemeOfWorkEntry.topic}</p>
                                  {slot.schemeOfWorkEntry.subTopic && <p className="text-gray-600">{slot.schemeOfWorkEntry.subTopic}</p>}
                                  {slot.schemeOfWorkEntry.learningObjectives && (
                                    <div>
                                      <span className="font-medium text-gray-700 flex items-center gap-1"><Target className="size-3" /> Objectives:</span>
                                      <p className="text-gray-500 ml-4">{slot.schemeOfWorkEntry.learningObjectives}</p>
                                    </div>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </>
                    )}
                  </div>
                  
                  <Badge variant={slot.isBreak ? "secondary" : "default"}>
                    {slot.isBreak ? "Break" : "Class"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {timetables.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Week Overview</CardTitle>
            <CardDescription>Quick view of all days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {DAYS.filter((_, i) => i >= 1 && i <= 6).map((day, i) => {
                const dayIndex = i + 1;
                let daySlots = slots.filter(s => s.dayOfWeek === dayIndex);
                if (currentRole === 'TEACHER' && userProfile?.teacherId) {
                  daySlots = daySlots.filter(s => s.teacherId === userProfile.teacherId);
                } else if (selectedClass) {
                  daySlots = daySlots.filter(s => s.classId === selectedClass);
                }
                
                return (
                  <button
                    key={dayIndex}
                    onClick={() => setSelectedDay(dayIndex)}
                    className={cn(
                      "p-3 rounded-lg text-center transition-all",
                      selectedDay === dayIndex 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-gray-50 hover:bg-gray-100"
                    )}
                  >
                    <div className="text-xs font-medium">{day.slice(0, 3)}</div>
                    <div className={cn(
                      "text-lg font-bold mt-1",
                      selectedDay === dayIndex ? "text-primary-foreground" : "text-gray-900"
                    )}>
                      {daySlots.length}
                    </div>
                    <div className={cn(
                      "text-[10px]",
                      selectedDay === dayIndex ? "text-primary-foreground/70" : "text-muted-foreground"
                    )}>
                      classes
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}