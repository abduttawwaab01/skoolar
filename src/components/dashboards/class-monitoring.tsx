'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { handleSilentError } from '@/lib/error-handler';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Eye, Users, GraduationCap, AlertTriangle, CheckCircle, XCircle, Clock,
  TrendingUp, TrendingDown, Search, Filter, MessageSquare, Flag, UserCheck,
  BookOpen, ClipboardList, BarChart3, Activity, FileText, ChevronRight, X, Send
} from 'lucide-react';

interface DashboardStats {
  totalStudents: number; totalTeachers: number; totalClasses: number;
  presentToday: number; attendanceRate: number; behaviorIssues: number;
  pendingHomework: number; avgExamScore: number;
}

interface ClassOverview {
  id: string; name: string; section: string | null; grade: string | null;
  capacity: number; studentCount: number; classTeacher: string;
  todayAttendanceRate: number; weekAttendanceRate: number;
  examCount: number; homeworkCount: number;
}

interface StudentInfo {
  id: string; name: string; email: string; admissionNo: string;
  className: string; lastLogin: string | null; gpa: number; behaviorScore: number;
  todayStatus: string;
}

interface TeacherPerf {
  id: string; name: string; email: string; lastLogin: string | null; loginCount: number;
  classesCount: number; classList: string[]; subjects: string[];
  totalStudents: number; examCount: number; commentCount: number;
}

interface StudentActivity {
  student: { id: string; name: string; email: string; className: string | null; lastLogin: string | null; admissionNo: string; gpa: number; behaviorScore: number };
  todayStatus: string; weekAttendanceRate: number; monthAttendanceRate: number;
  homeworkSubmissionRate: number; avgExamScore: number;
  recentScores: { score: number; exam: { totalMarks: number; subject: { name: string } } }[];
  behaviorLogs: { id: string; type: string; category: string; points: number; description: string; createdAt: string }[];
  recentComments: { id: string; comment: string; createdAt: string; teacher: { user: { name: string } } }[];
}

export function ClassMonitoring() {
  const { currentUser, currentRole, selectedSchoolId } = useAppStore();
  const schoolId = selectedSchoolId || currentUser.schoolId;

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [classes, setClasses] = useState<ClassOverview[]>([]);
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [teachers, setTeachers] = useState<TeacherPerf[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<StudentActivity | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteStudentId, setNoteStudentId] = useState('');
  const [noteStudentName, setNoteStudentName] = useState('');
  const [activeTab, setActiveTab] = useState('students');

  const fetchDashboard = useCallback(async () => {
    if (!schoolId) return;
    try {
      const [statsRes, classesRes, studentsRes, teachersRes] = await Promise.all([
        fetch(`/api/class-monitoring?action=monitoring-dashboard&schoolId=${schoolId}`).then(r => r.json()),
        fetch(`/api/class-monitoring?action=class-overview&schoolId=${schoolId}`).then(r => r.json()),
        fetch(`/api/class-monitoring?action=students-list&schoolId=${schoolId}`).then(r => r.json()),
        ...(currentRole === 'SCHOOL_ADMIN' || currentRole === 'SUPER_ADMIN'
          ? [fetch(`/api/class-monitoring?action=teacher-performance&schoolId=${schoolId}`).then(r => r.json())]
          : [Promise.resolve({ success: true, data: [] })]),
      ]);
      if (statsRes.success) setStats(statsRes.data);
      if (classesRes.success) setClasses(classesRes.data);
      if (studentsRes.success) setStudents(studentsRes.data);
      if (teachersRes.success) setTeachers(teachersRes.data);
    } catch (error: unknown) { handleSilentError(error); } finally { setLoading(false); }
  }, [schoolId, currentRole]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const fetchStudentDetail = async (studentId: string) => {
    try {
      const res = await fetch(`/api/class-monitoring?action=student-activity&schoolId=${schoolId}&studentId=${studentId}`);
      const json = await res.json();
      if (json.success) { setSelectedStudent(json.data); setDetailOpen(true); }
    } catch (error: unknown) { handleSilentError(error); }
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    try {
      const res = await fetch('/api/class-monitoring?action=add-note', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId, studentId: noteStudentId, note: noteText, addedBy: currentUser.id }),
      });
      const json = await res.json();
      if (json.success) { toast.success('Note added'); setNoteDialogOpen(false); setNoteText(''); fetchDashboard(); }
      else toast.error(json.message || 'Failed');
    } catch (error: unknown) { handleSilentError(error); }
  };

  const handleFlagStudent = async (studentId: string, studentName: string) => {
    if (!confirm(`Flag ${studentName} for attention?`)) return;
    try {
      const res = await fetch('/api/class-monitoring?action=flag-student', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId, studentId, reason: 'Flagged for attention by monitoring', flaggedBy: currentUser.id }),
      });
      const json = await res.json();
      if (json.success) toast.success('Student flagged');
      else toast.error(json.message);
    } catch (error: unknown) { handleSilentError(error); }
  };

  const openNoteDialog = (studentId: string, studentName: string) => {
    setNoteStudentId(studentId); setNoteStudentName(studentName); setNoteDialogOpen(true);
  };

  const filteredStudents = students.filter(s =>
    !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.admissionNo.toLowerCase().includes(searchQuery.toLowerCase()) || s.className.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-emerald-100 text-emerald-700';
      case 'absent': return 'bg-red-100 text-red-700';
      case 'late': return 'bg-amber-100 text-amber-700';
      default: return 'bg-gray-100 text-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Eye className="h-7 w-7 text-emerald-600" /> Class Monitoring</h1>
          <p className="text-sm text-gray-500 mt-1">Monitor student activity, teacher performance, and class health</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchDashboard}><Activity className="h-4 w-4 mr-1" /> Refresh</Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Students', value: stats.totalStudents, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Present Today', value: stats.presentToday, icon: UserCheck, color: 'text-emerald-600', bg: 'bg-emerald-50', sub: `${stats.attendanceRate}% rate` },
            { label: 'Behavior Issues', value: stats.behaviorIssues, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Avg Exam Score', value: `${stats.avgExamScore}%`, icon: BarChart3, color: 'text-purple-600', bg: 'bg-purple-50' },
          ].map((item, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 font-medium">{item.label}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{item.value}</p>
                    {item.sub && <p className="text-xs text-gray-400 mt-0.5">{item.sub}</p>}
                  </div>
                  <div className={`p-3 rounded-xl ${item.bg}`}><item.icon className={`h-5 w-5 ${item.color}`} /></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="students"><Users className="h-4 w-4 mr-1" /> Students</TabsTrigger>
          {(currentRole === 'SCHOOL_ADMIN' || currentRole === 'SUPER_ADMIN') && (
            <TabsTrigger value="teachers"><GraduationCap className="h-4 w-4 mr-1" /> Teachers</TabsTrigger>
          )}
          <TabsTrigger value="classes"><BookOpen className="h-4 w-4 mr-1" /> Classes</TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search students..." className="pl-10" /></div>
            <Select value={selectedClass} onValueChange={v => setSelectedClass(v)}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="All Classes" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Classes</SelectItem>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Student</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Class</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Today</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">GPA</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Behavior</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredStudents.filter(s => selectedClass === 'all' || selectedClass === '' || students.find(st => st.id === s.id)?.className?.includes(classes.find(c => c.id === selectedClass)?.name || '')).map(student => (
                      <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8"><AvatarFallback className="text-xs bg-emerald-100 text-emerald-700">{student.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</AvatarFallback></Avatar>
                            <div><p className="text-sm font-medium text-gray-900">{student.name}</p><p className="text-xs text-gray-400">{student.admissionNo}</p></div>
                          </div>
                        </td>
                        <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{student.className}</Badge></td>
                        <td className="px-4 py-3"><Badge className={`text-xs ${getStatusColor(student.todayStatus)}`}>{student.todayStatus === 'not_recorded' ? 'Not Recorded' : student.todayStatus}</Badge></td>
                        <td className="px-4 py-3"><span className={`text-sm font-medium ${student.gpa >= 3.0 ? 'text-emerald-600' : student.gpa >= 2.0 ? 'text-amber-600' : 'text-red-600'}`}>{student.gpa.toFixed(1)}</span></td>
                        <td className="px-4 py-3"><div className="flex items-center gap-2"><Progress value={student.behaviorScore} className="w-16 h-2" /><span className="text-xs text-gray-500">{student.behaviorScore}</span></div></td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => fetchStudentDetail(student.id)}><Eye className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openNoteDialog(student.id, student.name)}><MessageSquare className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-500" onClick={() => handleFlagStudent(student.id, student.name)}><Flag className="h-4 w-4" /></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredStudents.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400"><Users className="h-8 w-8 mx-auto mb-2 opacity-50" /><p>No students found</p></td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {(currentRole === 'SCHOOL_ADMIN' || currentRole === 'SUPER_ADMIN') && (
          <TabsContent value="teachers" className="space-y-4">
            <div className="grid gap-4">
              {teachers.map(teacher => (
                <Card key={teacher.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10"><AvatarFallback className="bg-purple-100 text-purple-700">{teacher.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</AvatarFallback></Avatar>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{teacher.name}</p>
                          <p className="text-xs text-gray-500">{teacher.email}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="text-xs">{teacher.classesCount} classes</Badge>
                        <Badge variant="outline" className="text-xs">{teacher.totalStudents} students</Badge>
                        <Badge variant="outline" className="text-xs">{teacher.examCount} exams</Badge>
                        {teacher.subjects.map(s => <Badge key={s} className="bg-purple-50 text-purple-700 text-xs">{s}</Badge>)}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400">Last login</p>
                        <p className="text-xs text-gray-600">{teacher.lastLogin ? new Date(teacher.lastLogin).toLocaleDateString() : 'Never'}</p>
                      </div>
                    </div>
                    {teacher.classList.length > 0 && (
                      <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                        <BookOpen className="h-3 w-3" /> Classes: {teacher.classList.join(', ')}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              {teachers.length === 0 && (
                <Card><CardContent className="py-12 text-center text-gray-400"><GraduationCap className="h-8 w-8 mx-auto mb-2 opacity-50" /><p>No teachers found</p></CardContent></Card>
              )}
            </div>
          </TabsContent>
        )}

        <TabsContent value="classes" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes.map(cls => (
              <Card key={cls.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => { setSelectedClass(cls.id); setActiveTab('students'); }}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900">{cls.name}</h3>
                    <Badge variant="outline" className="text-xs">{cls.studentCount}/{cls.capacity}</Badge>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-gray-500">Teacher</span><span className="text-gray-700">{cls.classTeacher}</span></div>
                    <div className="flex justify-between items-center"><span className="text-gray-500">Today</span><div className="flex items-center gap-2"><Progress value={cls.todayAttendanceRate} className="w-20 h-2" /><span className={cls.todayAttendanceRate >= 80 ? 'text-emerald-600' : cls.todayAttendanceRate >= 50 ? 'text-amber-600' : 'text-red-600'}>{cls.todayAttendanceRate}%</span></div></div>
                    <div className="flex justify-between items-center"><span className="text-gray-500">Week</span><div className="flex items-center gap-2"><Progress value={cls.weekAttendanceRate} className="w-20 h-2" /><span className="text-gray-600">{cls.weekAttendanceRate}%</span></div></div>
                    <Separator className="my-2" />
                    <div className="flex justify-between text-xs"><span className="text-gray-400">{cls.examCount} exams</span><span className="text-gray-400">{cls.homeworkCount} homeworks</span></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Student Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Student Activity - {selectedStudent?.student.name}</DialogTitle>
          </DialogHeader>
          {selectedStudent && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Today Status', value: selectedStudent.todayStatus, color: getStatusColor(selectedStudent.todayStatus) },
                  { label: 'Week Attendance', value: `${selectedStudent.weekAttendanceRate}%`, color: selectedStudent.weekAttendanceRate >= 80 ? 'text-emerald-600' : 'text-amber-600' },
                  { label: 'Homework Rate', value: `${selectedStudent.homeworkSubmissionRate}%`, color: selectedStudent.homeworkSubmissionRate >= 80 ? 'text-emerald-600' : 'text-amber-600' },
                  { label: 'Avg Score', value: `${selectedStudent.avgExamScore}%`, color: selectedStudent.avgExamScore >= 60 ? 'text-emerald-600' : 'text-red-600' },
                ].map((s, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">{s.label}</p><p className={`text-lg font-bold ${s.color}`}>{s.value}</p></div>
                ))}
              </div>
              {selectedStudent.recentScores.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Recent Exam Scores</h4>
                  <div className="space-y-2">
                    {selectedStudent.recentScores.slice(0, 5).map((s, i) => (
                      <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg p-2">
                        <span className="text-sm text-gray-700">{s.exam.subject.name}</span>
                        <span className={`text-sm font-bold ${s.score >= s.exam.totalMarks * 0.5 ? 'text-emerald-600' : 'text-red-600'}`}>{s.score}/{s.exam.totalMarks}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedStudent.behaviorLogs.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Behavior Logs</h4>
                  <div className="space-y-2">
                    {selectedStudent.behaviorLogs.slice(0, 5).map(log => (
                      <div key={log.id} className="flex items-start gap-2 bg-gray-50 rounded-lg p-2">
                        <Badge className={log.type === 'negative' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}>{log.type}</Badge>
                        <div><p className="text-sm">{log.description}</p><p className="text-xs text-gray-400">{new Date(log.createdAt).toLocaleDateString()}</p></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Note Dialog */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Note - {noteStudentName}</DialogTitle></DialogHeader>
          <Textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Enter monitoring note..." rows={4} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddNote}><Send className="h-4 w-4 mr-1" /> Add Note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
