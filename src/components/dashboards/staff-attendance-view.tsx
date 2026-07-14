'use client';

import * as React from 'react';
import { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAppStore } from '@/store/app-store';
import {
  Shield, Users, CalendarCheck, Clock, CheckCircle2, XCircle, AlertTriangle,
  TrendingUp, Search, QrCode, Download, Trash2, Calendar
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

interface StaffAttendanceRecord {
  id: string;
  staffId: string;
  staffName: string;
  employeeNo: string;
  role: string;
  status: string;
  date: string;
  checkInTime?: string;
  checkOutTime?: string;
}

interface StaffRecord {
  id: string;
  name: string;
  employeeNo: string;
  role: string;
  department?: string;
  photo?: string;
}

interface RangeDay {
  date: string;
  present: number;
  absent: number;
  late: number;
}

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6366f1'];

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayStr(): string {
  return toLocalDateStr(new Date());
}

function getWeekDays(dateStr: string): string[] {
  if (!dateStr) return [];
  const date = new Date(dateStr + 'T00:00:00');
  if (isNaN(date.getTime())) return [];
  const day = date.getDay();
  const monOffset = day === 0 ? -6 : 1 - day;
  const mon = new Date(date);
  mon.setDate(date.getDate() + monOffset);
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    days.push(toLocalDateStr(d));
  }
  return days;
}

const dayLabels: Record<string, string> = {
  'Mon': 'Mon', 'Tue': 'Tue', 'Wed': 'Wed', 'Thu': 'Thu', 'Fri': 'Fri', 'Sat': 'Sat', 'Sun': 'Sun',
};

function getDayLabel(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

export function StaffAttendanceView() {
  const { selectedSchoolId, currentUser } = useAppStore();
  const schoolId = currentUser.schoolId || selectedSchoolId || '';
  const [loading, setLoading] = useState(true);
  const [staffList, setStaffList] = useState<StaffRecord[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<StaffAttendanceRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [schoolInfo, setSchoolInfo] = useState<{ name: string; motto: string | null; address: string | null; phone: string | null; email: string | null } | null>(null);
  const [rangeData, setRangeData] = useState<RangeDay[]>([]);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (!selectedDate) {
      setSelectedDate(todayStr());
      return;
    }
    let cancelled = false;

    async function fetchData() {
      if (!schoolId || cancelled) {
        setLoading(false);
        return;
      }

      try {
        const [staffRes, attRes] = await Promise.all([
          fetch(`/api/users?schoolId=${schoolId}&limit=100&includeProfiles=true`),
          fetch(`/api/staff-attendance?schoolId=${schoolId}&date=${selectedDate}`)
        ]);

        if (cancelled) return;

        const [staffJson, attJson] = await Promise.all([staffRes.json(), attRes.json()]);

        if (cancelled) return;

        const allUsers = staffJson.data || [];
        const staff = allUsers.filter((u: any) => !['STUDENT', 'PARENT'].includes(u.role));

        setStaffList(staff.map((u: any) => {
          let employeeNo = 'N/A';
          if (u.teacherProfile?.employeeNo) employeeNo = u.teacherProfile.employeeNo;
          else if (u.accountantProfile?.employeeNo) employeeNo = u.accountantProfile.employeeNo;
          else if (u.librarianProfile?.employeeNo) employeeNo = u.librarianProfile.employeeNo;
          else if (u.directorProfile?.employeeNo) employeeNo = u.directorProfile.employeeNo;
          else if (u.role === 'SCHOOL_ADMIN') employeeNo = `ADMIN-${u.id.slice(0, 6)}`;
          else employeeNo = `USR-${u.id.slice(0, 6)}`;

          return {
            id: u.id,
            name: u.name,
            employeeNo,
            role: u.role,
            department: u.department || '',
          };
        }));

        const att = attJson.data || [];
        setAttendanceRecords(att.map((a: any, idx: number) => ({
          id: a.id || `att-${a.staffId}-${idx}`,
          staffId: a.staffId,
          staffName: a.staffName,
          employeeNo: a.employeeNo,
          role: a.role,
          status: a.status || 'not_marked',
          date: a.date,
          checkInTime: a.checkInTime,
          checkOutTime: a.checkOutTime,
        })));
      } catch {
        if (!cancelled) toast.error('Failed to load staff attendance');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();

    return () => { cancelled = true; };
  }, [schoolId, selectedDate]);

  // Fetch weekly range data for chart
  useEffect(() => {
    if (!selectedDate || !schoolId) return;
    let cancelled = false;

    async function fetchRange() {
      setRangeLoading(true);
      const weekDays = getWeekDays(selectedDate);
      const dateFrom = weekDays[0];
      const dateTo = weekDays[6];

      try {
        const res = await fetch(`/api/staff-attendance/range?dateFrom=${dateFrom}&dateTo=${dateTo}`);
        if (cancelled) return;
        const json = await res.json();
        if (json.data) {
          setRangeData(json.data);
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setRangeLoading(false);
      }
    }

    fetchRange();
    return () => { cancelled = true; };
  }, [selectedDate, schoolId]);

  const weeklyChartData = useMemo(() => {
    if (!selectedDate) return [];
    const weekDays = getWeekDays(selectedDate);
    return weekDays.map(dateStr => {
      const found = rangeData.find(r => r.date === dateStr);
      const dayName = getDayLabel(dateStr);
      return {
        day: dayName,
        present: found?.present || 0,
        absent: found?.absent || 0,
        late: found?.late || 0,
      };
    });
  }, [rangeData, selectedDate]);

  const filteredStaff = staffList.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.employeeNo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const presentCount = attendanceRecords.filter(a => a.status === 'present').length;
  const absentCount = attendanceRecords.filter(a => a.status === 'absent').length;
  const lateCount = attendanceRecords.filter(a => a.status === 'late').length;
  const totalStaff = staffList.length || 1;

  const pieData = [
    { name: 'Present', value: presentCount },
    { name: 'Absent', value: absentCount },
    { name: 'Late', value: lateCount },
    { name: 'Not Marked', value: Math.max(0, totalStaff - presentCount - absentCount - lateCount) },
  ];

  const handleDelete = async (recordId: string, staffName: string) => {
    if (!recordId || recordId.startsWith('temp-')) {
      toast.error('Cannot delete: record not yet saved');
      return;
    }
    setDeleting(recordId);
    try {
      const res = await fetch(`/api/staff-attendance?id=${recordId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        toast.success(`Deleted attendance for ${staffName}`);
        setAttendanceRecords(prev => prev.filter(r => r.id !== recordId));
      } else {
        toast.error(json.error || 'Failed to delete');
      }
    } catch {
      toast.error('Failed to delete attendance record');
    } finally {
      setDeleting(null);
    }
  };

  const handleClearDate = async () => {
    setClearing(true);
    try {
      const res = await fetch(`/api/staff-attendance?date=${selectedDate}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message);
        setAttendanceRecords(prev => prev.map(r => ({ ...r, status: 'not_marked', checkInTime: undefined, checkOutTime: undefined })));
      } else {
        toast.error(json.error || 'Failed to clear');
      }
    } catch {
      toast.error('Failed to clear attendance');
    } finally {
      setClearing(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 break-words">
            <Shield className="size-5 sm:size-6 text-emerald-600 shrink-0" />
            <span>Staff Attendance</span>
          </h2>
          <p className="text-muted-foreground text-sm">Track staff attendance and check-ins</p>
        </div>
        <div className="flex items-center gap-2 w-full xs:w-auto flex-wrap">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50">
                <Trash2 className="size-4 mr-1" />
                Clear Date
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear all attendance for {selectedDate}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will delete all staff attendance records for this date. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearDate} disabled={clearing} className="bg-red-600 hover:bg-red-700">
                  {clearing ? 'Clearing...' : 'Clear All'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="outline" size="sm" className="hidden sm:inline-flex" onClick={async () => {
            setQrCodeUrl(`/api/school/qr?type=staff_attendance&schoolId=${schoolId}`);
            try {
              const res = await fetch(`/api/schools/${schoolId}`);
              const json = await res.json();
              if (json.data) setSchoolInfo(json.data);
            } catch {}
            setShowQRCode(true);
          }}>
            <QrCode className="size-4 mr-2" />
            Show School QR
          </Button>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="px-3 py-2 border rounded-md text-sm flex-1 xs:flex-none min-w-[100px]"
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Staff</p>
                <p className="text-2xl font-bold">{staffList.length}</p>
              </div>
              <Users className="size-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Present Today</p>
                <p className="text-2xl font-bold text-emerald-600">{presentCount}</p>
              </div>
              <CheckCircle2 className="size-8 text-emerald-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Absent</p>
                <p className="text-2xl font-bold text-red-600">{absentCount}</p>
              </div>
              <XCircle className="size-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Attendance Rate</p>
                <p className="text-2xl font-bold text-amber-600">
                  {Math.round((presentCount / totalStaff) * 100)}%
                </p>
              </div>
              <TrendingUp className="size-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2">
        <Card className="overflow-visible">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Today's Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Weekly Trend</CardTitle>
            <CardDescription>Attendance for the week of {selectedDate}</CardDescription>
          </CardHeader>
          <CardContent>
            {rangeLoading ? (
              <div className="flex items-center justify-center h-[200px]">
                <Skeleton className="h-[180px] w-full" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={weeklyChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="present" stroke="#10b981" strokeWidth={2} name="Present" />
                  <Line type="monotone" dataKey="absent" stroke="#ef4444" strokeWidth={2} name="Absent" />
                  <Line type="monotone" dataKey="late" stroke="#f59e0b" strokeWidth={2} name="Late" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Staff List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-base">Staff Attendance - {selectedDate}</CardTitle>
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search staff..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-sm border rounded-md w-full sm:w-48"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            <table className="w-full text-sm min-w-[450px] sm:min-w-[550px]">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2.5 px-3 sm:px-4 font-medium sticky left-0 bg-white dark:bg-gray-950 z-10">Staff</th>
                  <th className="py-2.5 px-3 sm:px-4 font-medium hidden sm:table-cell">Employee No</th>
                  <th className="py-2.5 px-3 sm:px-4 font-medium hidden md:table-cell">Role</th>
                  <th className="py-2.5 px-3 sm:px-4 font-medium">Status</th>
                  <th className="py-2.5 px-3 sm:px-4 font-medium hidden md:table-cell">Check In</th>
                  <th className="py-2.5 px-3 sm:px-4 font-medium hidden md:table-cell">Check Out</th>
                  <th className="py-2.5 px-3 sm:px-4 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map(staff => {
                  const att = attendanceRecords.find(a => a.staffId === staff.id);
                  const status = att?.status || 'not_marked';
                  const hasRecord = att && att.id && !att.id.startsWith('temp-');
                  return (
                    <tr key={staff.id} className="border-b hover:bg-muted/50">
                      <td className="py-2.5 px-3 sm:px-4 font-medium sticky left-0 bg-white dark:bg-gray-950 z-10 whitespace-nowrap">{staff.name}</td>
                      <td className="py-2.5 px-3 sm:px-4 text-muted-foreground hidden sm:table-cell">{staff.employeeNo}</td>
                      <td className="py-2.5 px-3 sm:px-4 hidden md:table-cell">
                        <Badge variant="outline" className="text-xs whitespace-nowrap">{staff.role}</Badge>
                      </td>
                      <td className="py-2.5 px-3 sm:px-4">
                        <Badge className={
                          status === 'present' ? 'bg-emerald-100 text-emerald-700' :
                          status === 'absent' ? 'bg-red-100 text-red-700' :
                          status === 'late' ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-700'
                        }>
                          {status === 'present' ? 'Present' :
                           status === 'absent' ? 'Absent' :
                           status === 'late' ? 'Late' : 'Not Marked'}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 sm:px-4 text-muted-foreground hidden md:table-cell">{att?.checkInTime || '—'}</td>
                      <td className="py-2.5 px-3 sm:px-4 text-muted-foreground hidden md:table-cell">{att?.checkOutTime || '—'}</td>
                      <td className="py-2.5 px-3 sm:px-4">
                        {hasRecord ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0">
                                <Trash2 className="size-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete attendance for {staff.name}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will remove their attendance record for {selectedDate}. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(att!.id, staff.name)}
                                  disabled={deleting === att!.id}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  {deleting === att!.id ? 'Deleting...' : 'Delete'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* QR Code Dialog */}
      {showQRCode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowQRCode(false)}>
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-sm w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="text-center space-y-4">
              {schoolInfo && (
                <div className="space-y-1 pb-3 border-b">
                  <h3 className="text-lg font-bold">{schoolInfo.name}</h3>
                  {schoolInfo.motto && <p className="text-xs text-muted-foreground italic">"{schoolInfo.motto}"</p>}
                  {schoolInfo.address && <p className="text-xs text-muted-foreground">{schoolInfo.address}</p>}
                  {(schoolInfo.phone || schoolInfo.email) && (
                    <p className="text-xs text-muted-foreground">
                      {schoolInfo.phone}{schoolInfo.phone && schoolInfo.email && ' | '}{schoolInfo.email}
                    </p>
                  )}
                </div>
              )}
              <h3 className="text-lg font-bold">Staff Attendance QR Code</h3>
              <p className="text-sm text-muted-foreground">Print and paste this QR code for staff to scan</p>
              <div className="bg-white p-4 border-2 border-emerald-500 rounded-lg inline-block">
                <img src={qrCodeUrl} alt="School QR Code" className="w-36 h-36 sm:w-48 sm:h-48" />
              </div>
              <p className="text-xs text-muted-foreground">Staff can mark attendance by scanning this QR code</p>
              <div className="flex gap-2 justify-center flex-wrap">
                <Button variant="outline" size="sm" onClick={() => {
                  const link = document.createElement('a');
                  link.href = qrCodeUrl;
                  link.download = `attendance-qr-${schoolId}.png`;
                  link.click();
                }}>
                  <Download className="size-4 mr-2" />
                  Download
                </Button>
                <Button variant="outline" size="sm" onClick={() => window.print()}>
                  Print
                </Button>
                <Button variant="default" size="sm" onClick={() => setShowQRCode(false)}>
                  Close
                </Button>
              </div>
              <p className="text-[10px] text-gray-400 pt-2 border-t">Skoolar - Odebunmi Tawwāb</p>
            </div>
          </div>
        </div>
      )}
      <div className="print-only" style={{ display: 'none', position: 'fixed', bottom: 10, right: 10, fontSize: 10, color: '#999', opacity: 0.5, zIndex: 9999 }}>Skoolar - Odebunmi Tawwāb</div>
      <style>{`@media print{.print-only{display:block!important}}`}</style>
    </div>
  );
}
