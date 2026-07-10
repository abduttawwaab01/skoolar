'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { KpiCard } from '@/components/shared/kpi-card';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { CalendarCheck, AlertTriangle, Clock, WifiOff } from 'lucide-react';

type DayStatus = 'present' | 'absent' | 'late' | 'weekend' | 'future' | 'no-record';

interface ApiAttendanceRecord {
  id: string;
  studentId: string;
  date: string;
  status: string;
  remarks: string | null;
}

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function StudentAttendance() {
  const { currentUser, selectedSchoolId } = useAppStore();
  const schoolId = currentUser.schoolId || selectedSchoolId || '';

  const [mounted, setMounted] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [loading, setLoading] = useState(true);
  const [studentId, setStudentId] = useState('');
  const [attendanceRecords, setAttendanceRecords] = useState<ApiAttendanceRecord[]>([]);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const now = new Date();
    setSelectedMonth(String(now.getMonth()));
    setSelectedYear(String(now.getFullYear()));
    setMounted(true);
    setIsOffline(!navigator.onLine);

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const findStudent = async () => {
      try {
        const res = await fetch(`/api/students?schoolId=${schoolId}&search=${encodeURIComponent(currentUser.email)}&limit=5`);
        if (res.ok) {
          const json = await res.json();
          const data: { id: string }[] = json.data || json || [];
          if (data.length > 0) {
            setStudentId(data[0].id);
          }
        }
      } catch {
        if (!navigator.onLine) {
          toast.error('Offline - using cached data if available');
        } else {
          toast.error('Failed to load student info');
        }
      }
    };
    if (schoolId) findStudent();
  }, [currentUser.email, schoolId]);

  useEffect(() => {
    if (!studentId) return;
    const fetchAttendance = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/attendance?studentId=${studentId}&limit=200`);
        if (res.ok) {
          const json = await res.json();
          setAttendanceRecords(json.data || json || []);
        }
      } catch {
        if (!navigator.onLine) {
          toast.error('Offline - showing cached attendance');
        } else {
          toast.error('Failed to load attendance');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchAttendance();
  }, [studentId]);

  const month = parseInt(selectedMonth);
  const year = parseInt(selectedYear);

  const attendanceMap = useMemo(() => {
    const map = new Map<string, string>();
    attendanceRecords.forEach(r => {
      const dateKey = r.date.split('T')[0];
      if (!map.has(dateKey)) map.set(dateKey, r.status);
    });
    return map;
  }, [attendanceRecords]);

  const monthData = useMemo(() => {
    const days: { date: number; dayName: string; status: DayStatus }[] = [];
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 0; i < firstDay; i++) {
      days.push({ date: 0, dayName: '', status: 'future' });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const dayIdx = date.getDay();
      const isWeekend = dayIdx === 0 || dayIdx === 6;
      const isFuture = date > today;
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

      let status: DayStatus = 'no-record';
      if (isFuture) status = 'future';
      else if (isWeekend) status = 'weekend';
      else {
        const recordStatus = attendanceMap.get(dateStr);
        if (recordStatus === 'absent') status = 'absent';
        else if (recordStatus === 'late') status = 'late';
        else if (recordStatus === 'present') status = 'present';
      }

      days.push({ date: d, dayName: dayNames[dayIdx], status });
    }

    return days;
  }, [month, year, attendanceMap]);

  const stats = useMemo(() => {
    const present = monthData.filter(d => d.status === 'present').length;
    const absent = monthData.filter(d => d.status === 'absent').length;
    const late = monthData.filter(d => d.status === 'late').length;
    const total = present + absent + late;
    const rate = total > 0 ? ((present / total) * 100).toFixed(1) : '0';
    return { present, absent, late, total, rate };
  }, [monthData]);

  const statusClasses: Record<DayStatus, string> = {
    present: 'bg-emerald-100 text-emerald-700',
    absent: 'bg-red-100 text-red-700',
    late: 'bg-amber-100 text-amber-700',
    weekend: 'bg-gray-50 text-gray-300',
    future: 'bg-transparent text-gray-300',
    'no-record': 'bg-gray-100 text-gray-400',
  };

  if (!mounted || !selectedMonth) return null;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-32 mt-2" /></div>
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Attendance</h1>
          <p className="text-muted-foreground">View your attendance record</p>
        </div>
        <div className="flex items-center gap-2">
          {isOffline && (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
              <WifiOff className="size-3 mr-1" />
              Offline
            </Badge>
          )}
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {monthNames.map((name, i) => (
                <SelectItem key={i} value={String(i)}>{name} {year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Total School Days" value={stats.total} icon={CalendarCheck} iconBgColor="bg-blue-100" iconColor="text-blue-600" />
        <KpiCard title="Present" value={stats.present} icon={CalendarCheck} iconBgColor="bg-emerald-100" iconColor="text-emerald-600" />
        <KpiCard title="Absent" value={stats.absent} icon={AlertTriangle} iconBgColor="bg-red-100" iconColor="text-red-600" />
        <KpiCard title="Attendance Rate" value={`${stats.rate}%`} icon={Clock} iconBgColor="bg-purple-100" iconColor="text-purple-600" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="text-base">{monthNames[month]} {year}</CardTitle>
              <CardDescription>Attendance calendar</CardDescription>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1"><span className="size-3 rounded bg-emerald-100" /> Present</div>
              <div className="flex items-center gap-1"><span className="size-3 rounded bg-red-100" /> Absent</div>
              <div className="flex items-center gap-1"><span className="size-3 rounded bg-amber-100" /> Late</div>
              <div className="flex items-center gap-1"><span className="size-3 rounded bg-gray-100" /> No Record</div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthData.map((day, i) => (
              <div
                key={i}
                className={`aspect-square flex flex-col items-center justify-center rounded-lg text-sm ${statusClasses[day.status]} ${day.date === 0 ? 'invisible' : ''}`}
                title={day.date > 0 ? `${day.dayName} ${day.date}: ${day.status === 'no-record' ? 'Not marked' : day.status}` : ''}
              >
                <span className="text-xs font-medium">{day.date > 0 ? day.date : ''}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
