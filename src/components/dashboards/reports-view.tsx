'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/store/app-store';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { StatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3, Wallet, CalendarCheck, GraduationCap, Users, BookOpen,
  Download, FileText, FileSpreadsheet, Table, File,
} from 'lucide-react';
import { toast } from 'sonner';

interface ReportType {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

const reportTypes: ReportType[] = [
  { id: 'academic', name: 'Academic Report', description: 'Student performance, grades, and GPA analysis', icon: GraduationCap, color: 'bg-emerald-100 text-emerald-700' },
  { id: 'financial', name: 'Financial Report', description: 'Revenue, payments, and fee collection status', icon: Wallet, color: 'bg-blue-100 text-blue-700' },
  { id: 'attendance', name: 'Attendance Report', description: 'Student and class attendance statistics', icon: CalendarCheck, color: 'bg-amber-100 text-amber-700' },
  { id: 'student', name: 'Student Report', description: 'Enrollment, demographics, and student data', icon: Users, color: 'bg-purple-100 text-purple-700' },
  { id: 'staff', name: 'Staff Report', description: 'Teacher performance and workload analysis', icon: Users, color: 'bg-pink-100 text-pink-700' },
  { id: 'library', name: 'Library Report', description: 'Book inventory, borrows, and overdue stats', icon: BookOpen, color: 'bg-cyan-100 text-cyan-700' },
];

interface ReportData {
  totalStudents: number;
  totalTeachers: number;
  totalRevenue: number;
  attendanceRate: number;
  totalBooks: number;
  borrowedBooks: number;
}

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-24 rounded-xl" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}

export function ReportsView() {
  const { selectedSchoolId } = useAppStore();
  const [selectedFormat, setSelectedFormat] = React.useState('pdf');
  const [summary, setSummary] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSummaryData = async () => {
      const schoolId = selectedSchoolId || 'school-1';
      try {
        setLoading(true);

        const [analyticsRes, booksRes, borrowsRes] = await Promise.all([
          fetch(`/api/analytics?schoolId=${schoolId}`),
          fetch(`/api/library/books?schoolId=${schoolId}&limit=1`),
          fetch(`/api/library/borrow?schoolId=${schoolId}&limit=1`),
        ]);

        let data: ReportData = {
          totalStudents: 0,
          totalTeachers: 0,
          totalRevenue: 0,
          attendanceRate: 0,
          totalBooks: 0,
          borrowedBooks: 0,
        };

        if (analyticsRes.ok) {
          const json = await analyticsRes.json();
          const d = json.data;
          if (d?.schoolOverview) {
            data.totalStudents = d.schoolOverview.totalStudents;
            data.totalTeachers = d.schoolOverview.totalTeachers;
          }
          if (d?.financialData) {
            data.totalRevenue = d.financialData.totalRevenue || 0;
          }
          if (d?.attendanceByClass?.length > 0) {
            const avg = d.attendanceByClass.reduce((sum: number, c: { percentage: number }) => sum + c.percentage, 0);
            data.attendanceRate = Math.round(avg / d.attendanceByClass.length);
          }
        }

        if (booksRes.ok) {
          const json = await booksRes.json();
          data.totalBooks = json.total || 0;
        }

        if (borrowsRes.ok) {
          const json = await borrowsRes.json();
          data.borrowedBooks = json.total || 0;
        }

        setSummary(data);
      } catch (err) {
        toast.error('Failed to load report summary');
      } finally {
        setLoading(false);
      }
    };
    fetchSummaryData();
  }, [selectedSchoolId]);

  const handleGenerate = (reportName: string) => {
    toast.success(`${reportName} generation started`);
  };

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">Reports</h2>
        <p className="text-sm text-muted-foreground">Generate and download school reports</p>
      </div>

      {/* Summary KPIs */}
      {summary && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">Students</p>
            <p className="text-lg font-bold">{summary.totalStudents.toLocaleString()}</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">Teachers</p>
            <p className="text-lg font-bold">{summary.totalTeachers.toLocaleString()}</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">Revenue</p>
            <p className="text-lg font-bold">₦{(summary.totalRevenue / 1000000).toFixed(1)}M</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">Attendance</p>
            <p className="text-lg font-bold">{summary.attendanceRate}%</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">Books</p>
            <p className="text-lg font-bold">{summary.totalBooks}</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">Borrowed</p>
            <p className="text-lg font-bold">{summary.borrowedBooks}</p>
          </Card>
        </div>
      )}

      {/* Parameters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Start Date</Label>
              <Select defaultValue="2025-01-07">
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2025-01-07">Jan 7, 2025</SelectItem>
                  <SelectItem value="2024-09-01">Sep 1, 2024</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs text-muted-foreground">End Date</Label>
              <Select defaultValue="2025-03-28">
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2025-03-28">Mar 28, 2025</SelectItem>
                  <SelectItem value="2025-03-31">Mar 31, 2025</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Format</Label>
              <Select value={selectedFormat} onValueChange={setSelectedFormat}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">
                    <span className="flex items-center gap-2"><File className="size-3.5" />PDF</span>
                  </SelectItem>
                  <SelectItem value="csv">
                    <span className="flex items-center gap-2"><Table className="size-3.5" />CSV</span>
                  </SelectItem>
                  <SelectItem value="excel">
                    <span className="flex items-center gap-2"><FileSpreadsheet className="size-3.5" />Excel</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Type Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {reportTypes.map(report => (
          <Card key={report.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex size-10 items-center justify-center rounded-xl ${report.color}`}>
                    <report.icon className="size-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{report.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{report.description}</p>
                  </div>
                </div>
              </div>
              <Button variant="outline" size="sm" className="w-full mt-3 gap-1.5" onClick={() => handleGenerate(report.name)}>
                <Download className="size-3.5" />Generate
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Reports */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Reports</CardTitle>
          <CardDescription>Previously generated reports</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Type</th>
                  <th className="pb-2 font-medium">Format</th>
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={6} className="py-6 text-center text-muted-foreground text-sm">
                    Generate a report to see it here
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
