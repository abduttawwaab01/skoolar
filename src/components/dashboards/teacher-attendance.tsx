'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import {
  CalendarCheck, CheckCircle2, Save, UserCheck, Clock, AlertTriangle,
} from 'lucide-react';

type AttendanceStatus = 'present' | 'absent' | 'late';

interface StudentAttendance {
  id: string;
  name: string;
  admissionNo: string;
  status: AttendanceStatus;
}

interface ClassRecord {
  id: string;
  name: string;
  section: string | null;
  grade: string | null;
  _count: { students: number };
}

interface AttendanceHistoryRecord {
  date: string;
  present: number;
  absent: number;
  late: number;
  rate: number;
}

export function TeacherAttendance() {
  const { selectedSchoolId, currentUser } = useAppStore();
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [attendance, setAttendance] = useState<StudentAttendance[]>([]);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Fetch classes
  useEffect(() => {
    if (!selectedSchoolId) return;
    setLoading(true);
    fetch(`/api/classes?schoolId=${selectedSchoolId}&limit=100`)
      .then(res => res.json())
      .then(json => {
        const cls = json.data || [];
        setClasses(cls);
        if (!selectedClass && cls.length > 0) {
          setSelectedClass(cls[0].id);
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
        const students = (json.data || []).map((s: Record<string, unknown>) => ({
          id: s.id,
          name: (s.user as Record<string, unknown>)?.name || 'Unknown',
          admissionNo: s.admissionNo || '',
        }));
        setAttendance(students.map(s => ({
          ...s,
          status: 'present' as AttendanceStatus,
        })));
        setSubmitted(false);
      })
      .catch(() => toast.error('Failed to load students'));
  }, [selectedSchoolId, selectedClass]);

  // Fetch attendance history for selected class
  useEffect(() => {
    if (!selectedSchoolId || !selectedClass) return;
    setHistoryLoading(true);
    fetch(`/api/attendance?schoolId=${selectedSchoolId}&classId=${selectedClass}&limit=100`)
      .then(res => res.json())
      .then(json => {
        const records = json.data || [];
        // Group by date
        const dateMap = new Map<string, { present: number; absent: number; late: number }>();
        records.forEach((r: Record<string, unknown>) => {
          const dateStr = (r.date as string)?.split('T')[0] || '';
          if (!dateStr) return;
          const existing = dateMap.get(dateStr) || { present: 0, absent: 0, late: 0 };
          const status = r.status as string;
          if (status === 'present') existing.present++;
          else if (status === 'absent') existing.absent++;
          else if (status === 'late') existing.late++;
          dateMap.set(dateStr, existing);
        });
        const history = Array.from(dateMap.entries())
          .map(([date, counts]) => ({
            date,
            ...counts,
            rate: Math.round((counts.present / (counts.present + counts.absent + counts.late)) * 1000) / 10 || 0,
          }))
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 10);
        setAttendanceHistory(history);
      })
      .catch(() => toast.error('Failed to load attendance history'))
      .finally(() => setHistoryLoading(false));
  }, [selectedSchoolId, selectedClass]);

  const handleClassChange = (cls: string) => {
    setSelectedClass(cls);
  };

  const markAllPresent = () => {
    setAttendance(prev => prev.map(s => ({ ...s, status: 'present' as AttendanceStatus })));
  };

  const updateStatus = (id: string, status: AttendanceStatus) => {
    setAttendance(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  };

  const presentCount = attendance.filter(s => s.status === 'present').length;
  const absentCount = attendance.filter(s => s.status === 'absent').length;
  const lateCount = attendance.filter(s => s.status === 'late').length;

  const handleSubmit = async () => {
    if (!selectedSchoolId || !selectedClass) return;
    setSubmitting(true);
    const records = attendance.map(s => ({
      studentId: s.id,
      status: s.status,
    }));
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: selectedSchoolId,
          classId: selectedClass,
          date: selectedDate,
          markedBy: currentUser.id,
          records,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success('Attendance submitted successfully');
        setSubmitted(true);
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
        <div className="grid gap-4 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
        <Skeleton className="h-12 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    );
  }

  if (!selectedSchoolId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <AlertTriangle className="size-10 opacity-40 mb-3" />
        <p className="text-sm">Please select a school to view attendance</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mark Attendance</h1>
        <p className="text-muted-foreground">Record daily student attendance</p>
      </div>

      {/* Selectors */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>Select Class</Label>
          <Select value={selectedClass} onValueChange={handleClassChange}>
            <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
            <SelectContent>
              {classes.map(cls => (
                <SelectItem key={cls.id} value={cls.id}>{cls.name}{cls.section ? ` ${cls.section}` : ''}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Date</Label>
          <Input type="date" value={selectedDate} onChange={e => { setSelectedDate(e.target.value); setSubmitted(false); }} />
        </div>
        <div className="space-y-2">
          <Label>Summary</Label>
          <div className="flex items-center gap-3 h-10">
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
              <CheckCircle2 className="size-3 mr-1" /> Present: {presentCount}
            </Badge>
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
              Absent: {absentCount}
            </Badge>
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
              <Clock className="size-3 mr-1" /> Late: {lateCount}
            </Badge>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={markAllPresent} disabled={submitted}>
          <UserCheck className="size-4 mr-2" /> Mark All Present
        </Button>
        <Button onClick={handleSubmit} disabled={submitted || submitting}>
          <Save className="size-4 mr-2" /> {submitting ? 'Submitting...' : submitted ? 'Submitted ✓' : 'Submit Attendance'}
        </Button>
        {submitted && (
          <Badge variant="default" className="bg-emerald-600">Attendance recorded successfully</Badge>
        )}
      </div>

      {/* Student Table */}
      <Card>
        <CardContent className="p-0">
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Admission No</TableHead>
                  <TableHead className="w-40">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendance.map((student, i) => (
                  <TableRow key={student.id}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{student.name}</TableCell>
                    <TableCell className="text-muted-foreground">{student.admissionNo}</TableCell>
                    <TableCell>
                      <Select
                        value={student.status}
                        onValueChange={(v) => updateStatus(student.id, v as AttendanceStatus)}
                        disabled={submitted}
                      >
                        <SelectTrigger className={`h-8 text-xs ${student.status === 'present' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : student.status === 'absent' ? 'border-red-300 bg-red-50 text-red-700' : 'border-amber-300 bg-amber-50 text-amber-700'}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="present">Present</SelectItem>
                          <SelectItem value="absent">Absent</SelectItem>
                          <SelectItem value="late">Late</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
                {attendance.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No students found in this class
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Attendance History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Attendance History</CardTitle>
          <CardDescription>Recent attendance records</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {historyLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 rounded" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-center">Present</TableHead>
                  <TableHead className="text-center">Absent</TableHead>
                  <TableHead className="text-center">Late</TableHead>
                  <TableHead className="text-center">Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendanceHistory.map(record => (
                  <TableRow key={record.date}>
                    <TableCell className="font-medium">{record.date}</TableCell>
                    <TableCell className="text-center text-emerald-600">{record.present}</TableCell>
                    <TableCell className="text-center text-red-600">{record.absent}</TableCell>
                    <TableCell className="text-center text-amber-600">{record.late}</TableCell>
                    <TableCell className="text-center font-semibold">{record.rate}%</TableCell>
                  </TableRow>
                ))}
                {attendanceHistory.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No attendance history yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
