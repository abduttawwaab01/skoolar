'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/store/app-store';
import {
  Shield, Users, CalendarCheck, Clock, CheckCircle2, XCircle, AlertTriangle,
  TrendingUp, BarChart3, Search
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

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6366f1'];

export function StaffAttendanceView() {
  const { selectedSchoolId, currentUser } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [staffList, setStaffList] = useState<StaffRecord[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<StaffAttendanceRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch staff and attendance data
  useEffect(() => {
    let cancelled = false;
    
    async function fetchData() {
      if (!selectedSchoolId || cancelled) {
        setLoading(false);
        return;
      }
      
      try {
        const [staffRes, attRes] = await Promise.all([
          fetch(`/api/teachers?schoolId=${selectedSchoolId}&limit=100`),
          fetch(`/api/attendance?schoolId=${selectedSchoolId}&type=staff&date=${selectedDate}`)
        ]);
        
        if (cancelled) return;
        
        const [staffJson, attJson] = await Promise.all([staffRes.json(), attRes.json()]);
        
        if (cancelled) return;
        
        const staff = staffJson.data || staffJson || [];
        setStaffList(staff.map((t: Record<string, unknown>) => ({
          id: t.id,
          name: (t.user as Record<string, unknown>)?.name as string || 'Unknown',
          employeeNo: t.employeeNo || '',
          role: t.role || 'Teacher',
          department: t.department as string || '',
        })));
        
        const att = attJson.data || attJson || [];
        setAttendanceRecords(att.map((a: Record<string, unknown>, idx: number) => ({
          id: a.id || `att-${idx}`,
          staffId: a.staffId || '',
          staffName: a.staffName || '',
          employeeNo: a.employeeNo || '',
          role: a.role || 'Staff',
          status: a.status || 'present',
          date: a.date || selectedDate,
          checkInTime: a.checkInTime as string || '',
          checkOutTime: a.checkOutTime as string || '',
        })));
      } catch {
        if (!cancelled) toast.error('Failed to load staff attendance');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    
    fetchData();
    
    return () => { cancelled = true; };
  }, [selectedSchoolId, selectedDate]);

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

  const weeklyData = [
    { day: 'Mon', present: 45, absent: 5 },
    { day: 'Tue', present: 48, absent: 2 },
    { day: 'Wed', present: 42, absent: 8 },
    { day: 'Thu', present: 50, absent: 0 },
    { day: 'Fri', present: 47, absent: 3 },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="size-6 text-emerald-600" />
            Staff Attendance
          </h2>
          <p className="text-muted-foreground">Track staff attendance and check-ins</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="px-3 py-2 border rounded-md text-sm"
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
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
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
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
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="present" stroke="#10b981" strokeWidth={2} />
                <Line type="monotone" dataKey="absent" stroke="#ef4444" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Staff List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Staff Attendance - {selectedDate}</CardTitle>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search staff..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-sm border rounded-md w-48"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 font-medium">Staff</th>
                  <th className="py-2 font-medium">Employee No</th>
                  <th className="py-2 font-medium">Role</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 font-medium">Check In</th>
                  <th className="py-2 font-medium">Check Out</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map(staff => {
                  const att = attendanceRecords.find(a => a.staffId === staff.id);
                  const status = att?.status || 'not_marked';
                  return (
                    <tr key={staff.id} className="border-b hover:bg-muted/50">
                      <td className="py-2.5 font-medium">{staff.name}</td>
                      <td className="py-2.5 text-muted-foreground">{staff.employeeNo}</td>
                      <td className="py-2.5">
                        <Badge variant="outline" className="text-xs">{staff.role}</Badge>
                      </td>
                      <td className="py-2.5">
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
                      <td className="py-2.5 text-muted-foreground">{att?.checkInTime || '—'}</td>
                      <td className="py-2.5 text-muted-foreground">{att?.checkOutTime || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}