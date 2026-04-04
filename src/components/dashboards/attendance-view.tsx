'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { KpiCard } from '@/components/shared/kpi-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/store/app-store';
import {
  UserCheck, UserX, Clock, TrendingUp, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { motion } from 'framer-motion';

type AttendanceStatus = 'present' | 'absent' | 'late';

interface StudentRecord {
  id: string;
  name: string;
  classId: string;
  className: string;
  admissionNo: string;
  gpa?: number | null;
  behaviorScore?: number | null;
}

interface AttendanceRecord {
  id: string;
  studentId: string;
  status: string;
  date: string;
  student: {
    id: string;
    admissionNo: string;
    user: { name: string; email: string };
    class: { name: string; section: string; grade: string } | null;
  };
}

interface ClassRecord {
  id: string;
  name: string;
  section: string | null;
  grade: string | null;
  _count: { students: number };
}

export function AttendanceView() {
  const { selectedSchoolId, selectedClassId, setSelectedClassId } = useAppStore();
  const [selectedClass, setSelectedClass] = useState(selectedClassId || '');
  const [studentStatuses, setStudentStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Fetch classes
  useEffect(() => {
    if (!selectedSchoolId) return;
    setLoading(true);
    fetch(`/api/classes?schoolId=${selectedSchoolId}&limit=100`)
      .then(res => res.json())
      .then(json => {
        setClasses(json.data || []);
        if (!selectedClass && json.data?.length > 0) {
          setSelectedClass(json.data[0].id);
        }
      })
      .catch(() => toast.error('Failed to load classes'))
      .finally(() => setLoading(false));
  }, [selectedSchoolId]);

  // Fetch students for selected class
  useEffect(() => {
    if (!selectedSchoolId || !selectedClass) return;
    fetch(`/api/students?schoolId=${selectedSchoolId}&classId=${selectedClass}&limit=100`)
      .then(res => res.json())
      .then(json => {
        const sList = (json.data || []).map((s: Record<string, unknown>) => ({
          id: s.id,
          name: (s.user as Record<string, unknown>)?.name || 'Unknown',
          classId: s.classId,
          className: (s.class as Record<string, unknown>)?.name || '',
          admissionNo: s.admissionNo || '',
          gpa: s.gpa,
          behaviorScore: s.behaviorScore,
        }));
        setStudents(sList);
      })
      .catch(() => toast.error('Failed to load students'));
  }, [selectedSchoolId, selectedClass]);

  // Fetch attendance records
  useEffect(() => {
    if (!selectedSchoolId) return;
    fetch(`/api/attendance?schoolId=${selectedSchoolId}&limit=100`)
      .then(res => res.json())
      .then(json => setAttendanceRecords(json.data || []))
      .catch(() => toast.error('Failed to load attendance data'));
  }, [selectedSchoolId]);

  // Compute stats from attendance records
  const today = new Date().toISOString().split('T')[0];
  const todayRecords = attendanceRecords.filter(r => r.date && r.date.startsWith(today));
  const presentCount = todayRecords.filter(r => r.status === 'present').length || attendanceRecords.filter(r => r.status === 'present').length;
  const absentCount = todayRecords.filter(r => r.status === 'absent').length || attendanceRecords.filter(r => r.status === 'absent').length;
  const lateCount = todayRecords.filter(r => r.status === 'late').length || attendanceRecords.filter(r => r.status === 'late').length;
  const totalRecords = todayRecords.length || attendanceRecords.length;
  const rate = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 1000) / 10 : 0;

  // Weekly trend from attendance data
  const weeklyData = React.useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const last7Days: { day: string; present: number; absent: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayRecords = attendanceRecords.filter(r => r.date && r.date.startsWith(dateStr));
      const dayName = days[d.getDay() === 0 ? 6 : d.getDay() - 1];
      last7Days.push({
        day: dayName,
        present: dayRecords.filter(r => r.status === 'present').length,
        absent: dayRecords.filter(r => r.status === 'absent').length,
      });
    }
    return last7Days;
  }, [attendanceRecords]);

  const classStudents = selectedClass
    ? students.filter(s => s.classId === selectedClass)
    : students;

  const lowAttendanceStudents = students.filter(s => {
    const studentRecords = attendanceRecords.filter(r => r.studentId === s.id);
    if (studentRecords.length === 0) return false;
    const presentCount = studentRecords.filter(r => r.status === 'present').length;
    const studentRate = (presentCount / studentRecords.length) * 100;
    return studentRate < 80;
  });

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setStudentStatuses(prev => ({ ...prev, [studentId]: status }));
  };

  const handleClassChange = (classId: string) => {
    setSelectedClass(classId);
    setStudentStatuses({});
  };

  const handleSubmit = async () => {
    if (!selectedSchoolId || !selectedClass) return;
    setSubmitting(true);
    const records = Object.entries(studentStatuses).map(([studentId, status]) => ({
      studentId,
      status,
    }));
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: selectedSchoolId,
          classId: selectedClass,
          date: today,
          records,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(`Attendance submitted for ${records.length} students`);
        setStudentStatuses({});
        // Refresh attendance data
        const refreshRes = await fetch(`/api/attendance?schoolId=${selectedSchoolId}&limit=100`);
        const refreshJson = await refreshRes.json();
        setAttendanceRecords(refreshJson.data || []);
      } else {
        toast.error(json.error || 'Failed to submit attendance');
      }
    } catch {
      toast.error('Failed to submit attendance');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-lg" />
          <Skeleton className="h-72 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!selectedSchoolId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <AlertTriangle className="size-10 opacity-40 mb-3" />
        <p className="text-sm">Please select a school to view attendance data</p>
      </div>
    );
  }

  return (
    <motion.div 
      className="space-y-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Today's Stats */}
      <motion.div 
        className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 }}>
          <KpiCard title="Present" value={String(presentCount)} icon={UserCheck} iconBgColor="bg-emerald-100" iconColor="text-emerald-600" />
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}>
          <KpiCard title="Absent" value={String(absentCount)} icon={UserX} iconBgColor="bg-red-100" iconColor="text-red-600" />
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.25 }}>
          <KpiCard title="Late" value={String(lateCount)} icon={Clock} iconBgColor="bg-amber-100" iconColor="text-amber-600" />
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}>
          <KpiCard title="Rate" value={`${rate}%`} icon={TrendingUp} iconBgColor="bg-blue-100" iconColor="text-blue-600" change={2.3} changeLabel="vs last week" />
        </motion.div>
      </motion.div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Weekly Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Weekly Trend</CardTitle>
            <CardDescription>Present vs Absent over the week</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
                <Line type="monotone" dataKey="present" stroke="hsl(152, 69%, 31%)" strokeWidth={2.5} name="Present" />
                <Line type="monotone" dataKey="absent" stroke="hsl(0, 74%, 50%)" strokeWidth={2.5} name="Absent" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Mark Attendance */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Mark Attendance</CardTitle>
            <CardDescription>Record daily attendance for a class</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Class</Label>
                <Select value={selectedClass} onValueChange={handleClassChange}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent>
                    {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}{c.section ? ` ${c.section}` : ''}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {classStudents.map(student => (
                  <div key={student.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <span className="text-sm font-medium">{student.name}</span>
                    <Select
                      value={studentStatuses[student.id] || 'present'}
                      onValueChange={(v) => handleStatusChange(student.id, v as AttendanceStatus)}
                    >
                      <SelectTrigger className="w-28 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="present">
                          <span className="text-emerald-600">Present</span>
                        </SelectItem>
                        <SelectItem value="absent">
                          <span className="text-red-600">Absent</span>
                        </SelectItem>
                        <SelectItem value="late">
                          <span className="text-amber-600">Late</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                {classStudents.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No students found in this class</p>
                )}
              </div>
              <Button className="w-full" onClick={handleSubmit} disabled={submitting || Object.keys(studentStatuses).length === 0}>
                <CheckCircle2 className="size-4 mr-2" />{submitting ? 'Submitting...' : 'Submit Attendance'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Low Attendance Alert */}
      <Card className="border-amber-200 dark:border-amber-900">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-600" />
            <CardTitle className="text-base">Low Attendance Alert</CardTitle>
          </div>
          <CardDescription>Students with attendance below 80%</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 max-h-64 overflow-y-auto">
            {lowAttendanceStudents.map(s => {
              const studentRecords = attendanceRecords.filter(r => r.studentId === s.id);
              const present = studentRecords.filter(r => r.status === 'present').length;
              const studentRate = studentRecords.length > 0 ? Math.round((present / studentRecords.length) * 100) : 0;
              return (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-3">
                  <div>
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.className}</p>
                  </div>
                  <span className="text-sm font-bold text-red-600">{studentRate}%</span>
                </div>
              );
            })}
            {lowAttendanceStudents.length === 0 && (
              <p className="text-sm text-muted-foreground col-span-full text-center py-4">No students with low attendance 🎉</p>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
