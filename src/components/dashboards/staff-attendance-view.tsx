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
  TrendingUp, BarChart3, Search, QrCode
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
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');

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
           // Fetch all users with staff roles (not students/parents)
           fetch(`/api/users?schoolId=${selectedSchoolId}&limit=100&includeProfiles=true`),
           fetch(`/api/staff-attendance?schoolId=${selectedSchoolId}&date=${selectedDate}`)
         ]);
         
         if (cancelled) return;
         
         const [staffJson, attJson] = await Promise.all([staffRes.json(), attRes.json()]);
         
         if (cancelled) return;
         
         // Filter staff users (exclude students and parents)
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
         setAttendanceRecords(att.map((a: any) => ({
           id: a.id || `att-${a.staffId}-${Math.random()}`,
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

   // Weekly data: will be computed from actual attendance if we store more days, for now we keep it simple
   // We could fetch last 7 days of data and aggregate; but for now the chart shows placeholder
   // TODO: Implement weekly trend from attendance records across dates
   const weeklyData = [
     { day: 'Mon', present: 0, absent: 0 },
     { day: 'Tue', present: 0, absent: 0 },
     { day: 'Wed', present: 0, absent: 0 },
     { day: 'Thu', present: 0, absent: 0 },
     { day: 'Fri', present: 0, absent: 0 },
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
          <Button variant="outline" onClick={() => { setQrCodeUrl(`/api/school/qr?type=staff_attendance&schoolId=${selectedSchoolId}`); setShowQRCode(true); }}>
            <QrCode className="size-4 mr-2" />
            Show School QR
          </Button>
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

      {/* QR Code Dialog */}
      {showQRCode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowQRCode(false)}>
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="text-center space-y-4">
              <h3 className="text-lg font-bold">School Attendance QR Code</h3>
              <p className="text-sm text-muted-foreground">Print and paste this QR code for staff to scan</p>
              <div className="bg-white p-4 border-2 border-emerald-500 rounded-lg inline-block">
                <img src={qrCodeUrl} alt="School QR Code" className="w-48 h-48" />
              </div>
              <p className="text-xs text-muted-foreground">Staff can mark attendance by scanning this QR code</p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => window.print()}>
                  Print QR Code
                </Button>
                <Button variant="default" onClick={() => setShowQRCode(false)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}