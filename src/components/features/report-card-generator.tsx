'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Download, Printer, Send, FileSpreadsheet, FileText, ChevronLeft, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface StudentData {
  id: string;
  name: string;
  admissionNo: string;
  class: string;
  gender: string;
  gpa: number;
  attendance: number;
  rank?: number;
  house?: string;
}

interface ExamScoreData {
  subject: string;
  score: number;
}

interface TermData {
  id: string;
  name: string;
}

interface AcademicYearData {
  id: string;
  name: string;
  terms: TermData[];
}

export function ReportCardGenerator() {
  const [studentList, setStudentList] = useState<StudentData[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentData | null>(null);
  const [examResults, setExamResults] = useState<ExamScoreData[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYearData[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [loading, setLoading] = useState(true);
  const [showComments, setShowComments] = useState(true);
  const [showAttendance, setShowAttendance] = useState(true);
  const [showBehavior, setShowBehavior] = useState(true);
  const [showGPA, setShowGPA] = useState(true);
  const [showRank, setShowRank] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);

  // Fetch data from API
  useEffect(() => {
    async function fetchData() {
      try {
        const [studentsRes, classesRes] = await Promise.all([
          fetch('/api/students?limit=100'),
          fetch('/api/classes'),
        ]);

        if (studentsRes.ok) {
          const json = await studentsRes.json();
          const list: StudentData[] = (json.data || []).map((s: any) => ({
            id: s.id,
            name: s.name || s.user?.name || 'Unknown',
            admissionNo: s.admissionNo || 'N/A',
            class: s.class?.name || 'N/A',
            gender: s.gender || 'N/A',
            gpa: s.gpa || s.cumulativeGpa || 0,
            attendance: 0,
            rank: s.rank || undefined,
            house: s.house || undefined,
          }));
          setStudentList(list);
          if (list.length > 0) setSelectedStudent(list[0]);

          // Get unique classes
          const uniqueClasses = [...new Set(list.map(s => s.class).filter(c => c !== 'N/A'))];
          if (uniqueClasses.length > 0) {
            setClasses(uniqueClasses);
            setSelectedClass(uniqueClasses[0]);
          }
        }

        if (classesRes.ok) {
          const json = await classesRes.json();
          const classList = (json.data || []).map((c: any) => c.name);
          if (classList.length > 0 && classes.length === 0) {
            setClasses(classList);
            setSelectedClass(classList[0]);
          }
        }

        // Default academic year data
        const currentYear = new Date().getFullYear();
        setAcademicYears([{
          id: 'current',
          name: `${currentYear}/${currentYear + 1}`,
          terms: [
            { id: 'term-1', name: 'First Term' },
            { id: 'term-2', name: 'Second Term' },
            { id: 'term-3', name: 'Third Term' },
          ],
        }]);
        setSelectedTerm('term-2');

        // Default exam results for preview
        setExamResults([
          { subject: 'Mathematics', score: 78 },
          { subject: 'English Language', score: 85 },
          { subject: 'Basic Science', score: 72 },
          { subject: 'Social Studies', score: 68 },
          { subject: 'French', score: 55 },
          { subject: 'Computer Studies', score: 91 },
          { subject: 'Physical Education', score: 88 },
          { subject: 'Civic Education', score: 76 },
          { subject: 'Creative Arts', score: 82 },
          { subject: 'Agricultural Science', score: 64 },
        ]);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const student = selectedStudent || { id: '', name: 'Select Student', admissionNo: 'N/A', class: 'N/A', gender: 'N/A', gpa: 0, attendance: 0 };
  const initials = student.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const totalScore = examResults.reduce((a, r) => a + r.score, 0);
  const avgScore = examResults.length > 0 ? (totalScore / examResults.length).toFixed(1) : '0';
  const gpa = student.gpa.toFixed(2);
  const currentYear = academicYears.length > 0 ? academicYears[0] : null;
  const currentTerm = currentYear?.terms.find(t => t.id === selectedTerm) || currentYear?.terms[1];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 text-emerald-600 animate-spin" />
        <span className="ml-3 text-sm text-muted-foreground">Loading report data...</span>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      {/* Configuration */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Report Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Academic Year */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Academic Year</Label>
            <Select defaultValue={currentYear?.id || 'current'}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {academicYears.map(ay => (
                  <SelectItem key={ay.id} value={ay.id}>{ay.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Term */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Term</Label>
            <Select value={selectedTerm} onValueChange={setSelectedTerm}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {currentYear?.terms.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Class */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Class</Label>
            {classes.length === 0 ? (
              <p className="text-xs text-amber-600 flex items-center gap-1"><AlertCircle className="size-3" />No classes available</p>
            ) : (
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {classes.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Student */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Student</Label>
            {studentList.length === 0 ? (
              <p className="text-xs text-amber-600 flex items-center gap-1"><AlertCircle className="size-3" />No students available</p>
            ) : (
              <Select value={student.id} onValueChange={(id) => setSelectedStudent(studentList.find(s => s.id === id) || studentList[0])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {studentList.filter(s => selectedClass === '' || s.class === selectedClass).map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="text-xs font-medium">Include Sections</Label>
            {[
              { label: 'Teacher Comments', value: showComments, setter: setShowComments },
              { label: 'Attendance Summary', value: showAttendance, setter: setShowAttendance },
              { label: 'Behavior Rating', value: showBehavior, setter: setShowBehavior },
              { label: 'GPA Calculation', value: showGPA, setter: setShowGPA },
              { label: 'Class Rank', value: showRank, setter: setShowRank },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <Label className="text-xs">{item.label}</Label>
                <Switch checked={item.value} onCheckedChange={item.setter} />
              </div>
            ))}
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="text-xs font-medium">Export</Label>
            <div className="grid gap-1.5">
              <Button size="sm" className="w-full" onClick={() => toast.success('Exporting PDF...')}><FileText className="size-3.5 mr-1.5" /> Export PDF</Button>
              <Button size="sm" variant="outline" className="w-full" onClick={() => toast.success('Exporting Excel...')}><FileSpreadsheet className="size-3.5 mr-1.5" /> Export Excel</Button>
              <Button size="sm" variant="outline" className="w-full" onClick={() => toast.success('Sent to printer')}><Printer className="size-3.5 mr-1.5" /> Print</Button>
              <Button size="sm" variant="outline" className="w-full" onClick={() => toast.success('Report card sent to parents')}><Send className="size-3.5 mr-1.5" /> Send to Parents</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Card Preview */}
      <div className="space-y-3">
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="size-8" onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm text-muted-foreground">Page 1 of 1</span>
            <Button variant="outline" size="icon" className="size-8" disabled>
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <Badge variant="outline">Preview Mode</Badge>
        </div>

        {/* A4 Paper */}
        <div className="mx-auto bg-white shadow-xl rounded-sm border overflow-hidden" style={{ maxWidth: '700px', minHeight: '990px' }}>
          <div className="relative p-8 space-y-4">
            {/* School Header */}
            <div className="text-center border-b-2 border-emerald-600 pb-4">
              <div className="flex items-center justify-center gap-3 mb-1">
                <div className="w-12 h-12 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-lg">SK</div>
                <div>
                  <h1 className="text-xl font-bold text-gray-800">SKOOLAR</h1>
                  <p className="text-xs text-gray-500 italic">Excellence in Learning</p>
                </div>
              </div>
              <p className="text-[10px] text-gray-400">Multi-School Management Platform</p>
            </div>

            {/* Report Title */}
            <div className="text-center bg-emerald-600 text-white py-2 rounded">
              <h2 className="text-sm font-bold tracking-wider">END OF TERM REPORT CARD</h2>
              <p className="text-[10px] opacity-80">{currentTerm?.name || 'Second Term'} — {currentYear?.name || `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`}</p>
            </div>

            {/* Student Info */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs border p-3 rounded bg-gray-50">
              <div><span className="text-gray-500">Name:</span> <span className="font-semibold">{student.name}</span></div>
              <div><span className="text-gray-500">Admission No:</span> <span className="font-semibold">{student.admissionNo}</span></div>
              <div><span className="text-gray-500">Class:</span> <span className="font-semibold">{student.class}</span></div>
              <div><span className="text-gray-500">Gender:</span> <span className="font-semibold">{student.gender}</span></div>
              <div><span className="text-gray-500">Term:</span> <span className="font-semibold">{currentTerm?.name || 'N/A'}</span></div>
              <div><span className="text-gray-500">No. in Class:</span> <span className="font-semibold">—</span></div>
              <div><span className="text-gray-500">Position:</span> <span className="font-semibold">{student.rank ? `${student.rank}${student.rank === 1 ? 'st' : student.rank === 2 ? 'nd' : student.rank === 3 ? 'rd' : 'th'}` : '—'}</span></div>
              <div><span className="text-gray-500">House:</span> <span className="font-semibold">{student.house || '—'}</span></div>
            </div>

            {/* Subjects Table */}
            <div className="overflow-hidden rounded border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-emerald-600 text-white">
                    <th className="py-1.5 px-2 text-left font-semibold">S/N</th>
                    <th className="py-1.5 px-2 text-left font-semibold">Subject</th>
                    <th className="py-1.5 px-2 text-center font-semibold w-14">CA1 (20)</th>
                    <th className="py-1.5 px-2 text-center font-semibold w-14">CA2 (20)</th>
                    <th className="py-1.5 px-2 text-center font-semibold w-14">Exam (60)</th>
                    <th className="py-1.5 px-2 text-center font-semibold w-14">Total (100)</th>
                    <th className="py-1.5 px-2 text-center font-semibold w-10">Grade</th>
                    <th className="py-1.5 px-2 text-center font-semibold w-10">Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {examResults.map((result, i) => {
                    const ca1 = Math.round(result.score * 0.18);
                    const ca2 = Math.round(result.score * 0.14);
                    const exam = Math.round(result.score * 0.58);
                    const total = ca1 + ca2 + exam;
                    const grade = total >= 80 ? 'A' : total >= 70 ? 'B' : total >= 60 ? 'C' : total >= 50 ? 'D' : 'F';
                    const gradeColor = grade === 'A' ? 'text-emerald-600' : grade === 'B' ? 'text-blue-600' : grade === 'C' ? 'text-amber-600' : 'text-red-600';
                    const remark = grade === 'A' ? 'Excellent' : grade === 'B' ? 'Very Good' : grade === 'C' ? 'Good' : grade === 'D' ? 'Fair' : 'Poor';
                    return (
                      <tr key={i} className={cn('border-b last:border-0', i % 2 === 0 ? 'bg-white' : 'bg-gray-50')}>
                        <td className="py-1.5 px-2">{i + 1}</td>
                        <td className="py-1.5 px-2 font-medium">{result.subject}</td>
                        <td className="py-1.5 px-2 text-center">{ca1}</td>
                        <td className="py-1.5 px-2 text-center">{ca2}</td>
                        <td className="py-1.5 px-2 text-center">{exam}</td>
                        <td className="py-1.5 px-2 text-center font-bold">{total}</td>
                        <td className="py-1.5 px-2 text-center font-bold"><span className={gradeColor}>{grade}</span></td>
                        <td className="py-1.5 px-2 text-center text-[10px]">{remark}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-emerald-50 font-bold">
                    <td colSpan={5} className="py-1.5 px-2 text-right">Total & Average</td>
                    <td className="py-1.5 px-2 text-center">{totalScore}</td>
                    <td colSpan={2} className="py-1.5 px-2 text-center">{avgScore}%</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Summary Row */}
            <div className="grid grid-cols-4 gap-2 text-xs text-center">
              {showGPA && (
                <div className="border rounded p-2 bg-emerald-50">
                  <p className="text-muted-foreground">GPA</p>
                  <p className="text-lg font-bold text-emerald-700">{gpa || '0.00'}</p>
                  <p className="text-xs text-muted-foreground">out of 5.00</p>
                </div>
              )}
              {showRank && (
                <div className="border rounded p-2 bg-blue-50">
                  <p className="text-muted-foreground">Class Rank</p>
                  <p className="text-lg font-bold text-blue-700">{student.rank || '—'}</p>
                  <p className="text-xs text-muted-foreground">of {studentList.length} students</p>
                </div>
              )}
              {showAttendance && (
                <div className="border rounded p-2 bg-amber-50">
                  <p className="text-muted-foreground">Attendance</p>
                  <p className="text-lg font-bold text-amber-700">{student.attendance || 0}%</p>
                  <p className="text-xs text-muted-foreground">school days attended</p>
                </div>
              )}
              {showBehavior && (
                <div className="border rounded p-2 bg-purple-50">
                  <p className="text-muted-foreground">Behavior</p>
                  <p className="text-lg font-bold text-purple-700">★★★★</p>
                  <p className="text-xs text-muted-foreground">Excellent</p>
                </div>
              )}
            </div>

            {/* Grading Key */}
            <div className="text-[10px] text-gray-500 border p-2 rounded bg-gray-50">
              <p className="font-semibold text-gray-600 mb-1">Grading Key:</p>
              <span>A (70-100) = Excellent | B (60-69) = Very Good | C (50-59) = Good | D (45-49) = Fair | F (0-44) = Poor</span>
            </div>

            {/* Teacher Comment */}
            {showComments && (
              <div className="border rounded p-3 space-y-2">
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 mb-0.5">Class Teacher&apos;s Comment:</p>
                  <p className="text-xs italic text-gray-700">&quot;A diligent student who shows great promise. Consistent effort is needed to reach full potential.&quot;</p>
                  <p className="text-[10px] text-right text-gray-400 mt-1">— Class Teacher</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 mb-0.5">Principal&apos;s Comment:</p>
                  <p className="text-xs italic text-gray-700">&quot;Keep up the good work. I wish you greater success next term.&quot;</p>
                </div>
              </div>
            )}

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-8 mt-4">
              <div className="text-center">
                <div className="border-b border-gray-300 mb-1 h-10" />
                <p className="text-[10px] text-gray-500">Class Teacher</p>
              </div>
              <div className="text-center">
                <div className="border-b border-gray-300 mb-1 h-10" />
                <p className="text-[10px] text-gray-500">Principal</p>
              </div>
            </div>

            {/* Next Term */}
            <div className="text-center text-xs text-gray-500 border-t pt-2">
              <p className="font-semibold">Next Term Begins: <span className="text-gray-800">April 21, {new Date().getFullYear() + 1}</span></p>
            </div>
          </div>

          {/* Footer Watermark */}
          <div className="bg-gray-100 py-1.5 px-4 text-center">
            <p className="text-xs text-gray-300 opacity-60">Powered by Skoolar || Odebunmi Tawwāb</p>
          </div>
        </div>
      </div>
    </div>
  );
}
