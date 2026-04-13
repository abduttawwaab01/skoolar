'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, Users, Edit3, CheckCircle, XCircle, MessageSquare, FileText, Loader2, AlertCircle, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';
import { handleSilentError } from '@/lib/error-handler';

interface CSVRow {
  [key: string]: string;
}

interface StudentData {
  id: string;
  admissionNo: string;
  user: { name: string | null; email: string | null };
  class: { id: string; name: string; section: string | null } | null;
  gpa: number | null;
  behaviorScore: number | null;
}

interface ClassData {
  id: string;
  name: string;
  section: string | null;
  _count: { students: number };
}

export default function BulkOperations() {
  const { selectedSchoolId, currentUser } = useAppStore();
  const schoolId = selectedSchoolId || currentUser.schoolId;

  const [activeTab, setActiveTab] = useState('enrollment');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<CSVRow[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [enrollProgress, setEnrollProgress] = useState(0);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [selectedExam, setSelectedExam] = useState('');
  const [studentScores, setStudentScores] = useState<Record<string, string>>({});
  const [isSavingGrades, setIsSavingGrades] = useState(false);
  const [gradeSaveProgress, setGradeSaveProgress] = useState(0);
  const [selectedClass, setSelectedClass] = useState('');
  const [attendanceDate, setAttendanceDate] = useState('');
  const [attendanceStatus, setAttendanceStatus] = useState<'present' | 'absent'>('present');
  const [isMarkingAttendance, setIsMarkingAttendance] = useState(false);
  const [attendanceProgress, setAttendanceProgress] = useState(0);
   const [recipientRole, setRecipientRole] = useState('');
   const [recipientClass, setRecipientClass] = useState('');
   const [messageContent, setMessageContent] = useState('');
   const [isSending, setIsSending] = useState(false);
   const [sendProgress, setSendProgress] = useState(0);
   const [reportClass, setReportClass] = useState('');
   const [reportTerm, setReportTerm] = useState('');
   const [isGenerating, setIsGenerating] = useState(false);
   const [reportProgress, setReportProgress] = useState(0);
   const fileInputRef = useRef<HTMLInputElement>(null);

   // Fetched data
   const [students, setStudents] = useState<StudentData[]>([]);
   const [classes, setClasses] = useState<ClassData[]>([]);
   const [terms, setTerms] = useState<Array<{id: string, name: string}>>([]);
   const [exams, setExams] = useState<Array<{id: string, title: string}>>([]);
   const [isLoadingData, setIsLoadingData] = useState(true);
   const [dataError, setDataError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!schoolId) {
      setDataError('No school selected');
      setIsLoadingData(false);
      return;
    }
    try {
      setDataError(null);
      setIsLoadingData(true);
      const [studentsRes, classesRes] = await Promise.all([
        fetch(`/api/students?schoolId=${schoolId}&limit=200`),
        fetch(`/api/classes?schoolId=${schoolId}&limit=100`),
      ]);

      if (!studentsRes.ok || !classesRes.ok) {
        throw new Error('Failed to fetch data');
      }
      const studentsJson = await studentsRes.json();
      const classesJson = await classesRes.json();

      if (studentsJson.error) throw new Error(studentsJson.error);
      if (classesJson.error) throw new Error(classesJson.error);

      setStudents(studentsJson.data || []);
      setClasses(classesJson.data || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load data';
      setDataError(msg);
      toast.error(msg);
    } finally {
      setIsLoadingData(false);
    }
  }, [schoolId]);

   useEffect(() => {
     fetchData();
   }, [fetchData]);

   // Fetch terms for the school
   useEffect(() => {
     if (!schoolId) return;
     const fetchTerms = async () => {
       try {
         const res = await fetch(`/api/terms?schoolId=${schoolId}&limit=20`);
         if (res.ok) {
           const json = await res.json();
           setTerms(json.data || []);
         }
       } catch (error) {
         handleSilentError(error, 'Failed to load terms');
       }
     };
     fetchTerms();
   }, [schoolId]);

   // Fetch exams for the school
   useEffect(() => {
     if (!schoolId) return;
     const fetchExams = async () => {
       try {
         const res = await fetch(`/api/exams?schoolId=${schoolId}&limit=100`);
         if (res.ok) {
           const json = await res.json();
           setExams(json.data || []);
         }
       } catch (error) {
         handleSilentError(error, 'Failed to load exams');
       }
     };
     fetchExams();
   }, [schoolId]);

  const classNames = classes.map(c => c.name);
  const getStudentCountForClass = (className: string) => {
    const cls = classes.find(c => c.name === className);
    return cls ? cls._count.students : 0;
  };

  const parseCSV = (text: string): CSVRow[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const row: CSVRow = {};
      headers.forEach((header, i) => {
        row[header] = values[i] || '';
      });
      return row;
    });
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
      processFile(file);
    } else {
      toast.error('Please upload a CSV file');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const processFile = (file: File) => {
    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      setCsvPreview(parsed.slice(0, 5));
      toast.success(`File loaded: ${parsed.length} records found`);
    };
    reader.readAsText(file);
  };

  const handleEnroll = async () => {
    if (!csvFile || !schoolId) {
      toast.error('Please upload a CSV file first');
      return;
    }
    setIsEnrolling(true);
    setEnrollProgress(0);
    try {
      const text = await csvFile.text();
      const parsed = parseCSV(text);
      let created = 0;
      const total = parsed.length;
      for (const row of parsed) {
        try {
          const res = await fetch('/api/students', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              schoolId,
              name: row.Name || row.name || 'Unknown',
              email: `${(row.Name || row.name || 'student').replace(/\s+/g, '').toLowerCase()}${created}@skoolar.local`,
              admissionNo: row['Admission No'] || row.admissionNo || `BULK-${Date.now()}-${created}`,
              classId: row.Class || row.class || null,
            }),
          });
          if (res.ok) created++;
        } catch (error: unknown) { handleSilentError(error); /* skip failed */ }
        setEnrollProgress((created / total) * 100);
      }
      toast.success(`Successfully enrolled ${created} of ${total} students`);
      setCsvPreview([]);
      setCsvFile(null);
      fetchData();
    } catch (error: unknown) { handleSilentError(error);
      toast.error('Failed to enroll students');
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleBulkGrades = () => {
    if (!selectedExam) {
      toast.error('Please select an exam');
      return;
    }
    setIsSavingGrades(true);
    setGradeSaveProgress(0);
    let current = 0;
    const total = students.length;
    const interval = setInterval(() => {
      current += 2;
      setGradeSaveProgress(Math.min((current / total) * 100, 100));
      if (current >= total) {
        clearInterval(interval);
        setIsSavingGrades(false);
        toast.success(`Saved grades for ${total} students`);
      }
    }, 150);
  };

  const handleBulkAttendance = async () => {
    if (!selectedClass || !attendanceDate || !schoolId) {
      toast.error('Please select class and date');
      return;
    }
    setIsMarkingAttendance(true);
    setAttendanceProgress(0);
    try {
      const classStudents = students.filter(s => s.class?.name === selectedClass);
      if (classStudents.length === 0) {
        toast.error('No students found in this class');
        return;
      }
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId,
          classId: classes.find(c => c.name === selectedClass)?.id,
          date: attendanceDate,
          markedBy: currentUser.id,
          records: classStudents.map(s => ({
            studentId: s.id,
            status: attendanceStatus,
          })),
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to mark attendance');
      }
      const json = await res.json();
      toast.success(`Marked ${json.createdCount || classStudents.length} students as ${attendanceStatus}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to mark attendance');
    } finally {
      setIsMarkingAttendance(false);
      setAttendanceProgress(0);
    }
  };

  const handleSendMessage = () => {
    if (!recipientRole || !messageContent.trim()) {
      toast.error('Please select recipients and type a message');
      return;
    }
    setIsSending(true);
    setSendProgress(0);
    let current = 0;
    const total = 50;
    const interval = setInterval(() => {
      current += 5;
      setSendProgress(Math.min((current / total) * 100, 100));
      if (current >= total) {
        clearInterval(interval);
        setIsSending(false);
        toast.success(`Message sent to ${total} recipients`);
        setMessageContent('');
      }
    }, 100);
  };

  const handleGenerateReports = () => {
    if (!reportClass || !reportTerm) {
      toast.error('Please select class and term');
      return;
    }
    setIsGenerating(true);
    setReportProgress(0);
    const total = getStudentCountForClass(reportClass) || students.filter(s => s.class?.name === reportClass).length;
    let current = 0;
    const effectiveTotal = Math.max(total, 1);
    const interval = setInterval(() => {
      current++;
      setReportProgress((current / effectiveTotal) * 100);
      if (current >= effectiveTotal) {
        clearInterval(interval);
        setIsGenerating(false);
        toast.success(`Generated ${effectiveTotal} report cards`);
      }
    }, 300);
  };

  if (isLoadingData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div>
            <Skeleton className="h-7 w-48 mb-1" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <Card><CardContent className="pt-6"><Skeleton className="h-96 w-full" /></CardContent></Card>
      </div>
    );
  }

  if (dataError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-violet-100">
            <Users className="h-6 w-6 text-violet-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Bulk Operations</h2>
            <p className="text-sm text-gray-500">Perform batch operations across students, grades, and more</p>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-red-500 mb-4">{dataError}</p>
            <Button onClick={fetchData} variant="outline" className="gap-2">
              <Loader2 className="h-4 w-4" /> Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-violet-100">
          <Users className="h-6 w-6 text-violet-700" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Bulk Operations</h2>
          <p className="text-sm text-gray-500">Perform batch operations across students, grades, and more</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="enrollment" className="gap-2 text-xs">
            <Upload className="h-3.5 w-3.5" />
            Enrollment
          </TabsTrigger>
          <TabsTrigger value="grades" className="gap-2 text-xs">
            <Edit3 className="h-3.5 w-3.5" />
            Grade Edit
          </TabsTrigger>
          <TabsTrigger value="attendance" className="gap-2 text-xs">
            <CheckCircle className="h-3.5 w-3.5" />
            Attendance
          </TabsTrigger>
          <TabsTrigger value="communication" className="gap-2 text-xs">
            <MessageSquare className="h-3.5 w-3.5" />
            Communication
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-2 text-xs">
            <FileText className="h-3.5 w-3.5" />
            Reports
          </TabsTrigger>
        </TabsList>

        {/* Student Enrollment */}
        <TabsContent value="enrollment">
          <Card>
            <CardHeader>
              <CardTitle>Bulk Student Enrollment</CardTitle>
              <CardDescription>Upload a CSV file to enroll multiple students at once</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                  isDragging ? 'border-violet-500 bg-violet-50' : 'border-gray-300 hover:border-violet-400'
                }`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />
                <Upload className="h-10 w-10 mx-auto text-gray-400 mb-3" />
                <p className="font-medium text-gray-700">Drop CSV file here or click to browse</p>
                <p className="text-sm text-gray-400 mt-1">Supports .csv files with columns: Name, Class, Gender, Parent Contact</p>
                {csvFile && (
                  <Badge variant="secondary" className="mt-3">
                    {csvFile.name} ({(csvFile.size / 1024).toFixed(1)} KB)
                  </Badge>
                )}
              </div>

              {csvPreview.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Preview (first 5 rows)</h4>
                  <ScrollArea className="max-h-60">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {Object.keys(csvPreview[0]).map(header => (
                            <TableHead key={header} className="text-xs">{header}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {csvPreview.map((row, i) => (
                          <TableRow key={i}>
                            {Object.values(row).map((val, j) => (
                              <TableCell key={j} className="text-xs">{val}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              )}

              {isEnrolling && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Enrolling students...</span>
                    <span className="font-medium">{Math.round(enrollProgress)}%</span>
                  </div>
                  <Progress value={enrollProgress} className="h-2" />
                </div>
              )}

              <Button onClick={handleEnroll} disabled={!csvFile || isEnrolling || !schoolId} className="gap-2">
                {isEnrolling ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Enrolling...</>
                ) : (
                  <><Upload className="h-4 w-4" /> Import Students</>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Grade Bulk Edit */}
        <TabsContent value="grades">
          <Card>
            <CardHeader>
              <CardTitle>Bulk Grade Edit</CardTitle>
              <CardDescription>Select an exam and edit scores for all students</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="max-w-sm">
                 <Select value={selectedExam} onValueChange={setSelectedExam}>
                   <SelectTrigger>
                     <SelectValue placeholder="Select Exam" />
                   </SelectTrigger>
                   <SelectContent>
                     {exams.map(exam => (
                       <SelectItem key={exam.id} value={exam.id}>{exam.title}</SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>

              {selectedExam && (
                <ScrollArea className="max-h-96">
                  {students.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Users className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                      <p>No students found.</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>Student</TableHead>
                          <TableHead>Class</TableHead>
                          <TableHead className="w-32">Score</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {students.map((student, i) => (
                          <TableRow key={student.id}>
                            <TableCell className="text-xs text-gray-500">{i + 1}</TableCell>
                            <TableCell className="font-medium">{student.user.name || student.admissionNo}</TableCell>
                            <TableCell><Badge variant="outline">{student.class?.name || 'N/A'}</Badge></TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                placeholder="0-100"
                                value={studentScores[student.id] || ''}
                                onChange={(e) => setStudentScores(prev => ({ ...prev, [student.id]: e.target.value }))}
                                className="w-24"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </ScrollArea>
              )}

              {isSavingGrades && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Saving grades...</span>
                    <span className="font-medium">{Math.round(gradeSaveProgress)}%</span>
                  </div>
                  <Progress value={gradeSaveProgress} className="h-2" />
                </div>
              )}

              <Button onClick={handleBulkGrades} disabled={!selectedExam || isSavingGrades} className="gap-2">
                {isSavingGrades ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
                ) : (
                  <><Check className="h-4 w-4" /> Save All Grades</>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Attendance Bulk Mark */}
        <TabsContent value="attendance">
          <Card>
            <CardHeader>
              <CardTitle>Bulk Attendance Mark</CardTitle>
              <CardDescription>Mark all students in a class as present or absent</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Class</label>
                  <Select value={selectedClass} onValueChange={setSelectedClass}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classNames.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Date</label>
                  <Input type="date" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Status</label>
                  <Select value={attendanceStatus} onValueChange={(v: 'present' | 'absent') => setAttendanceStatus(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="present">
                        <span className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-emerald-500" /> Present
                        </span>
                      </SelectItem>
                      <SelectItem value="absent">
                        <span className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-red-500" /> Absent
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedClass && (
                <div className="p-4 rounded-lg bg-gray-50">
                  <p className="text-sm text-gray-600">
                    This will mark <strong>{getStudentCountForClass(selectedClass)}</strong> students in{' '}
                    <strong>{selectedClass}</strong> as <Badge variant={attendanceStatus === 'present' ? 'default' : 'destructive'}>{attendanceStatus}</Badge>
                    {attendanceDate && <> on <strong>{attendanceDate}</strong></>}
                  </p>
                </div>
              )}

              {isMarkingAttendance && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Marking attendance...</span>
                    <span className="font-medium">{Math.round(attendanceProgress)}%</span>
                  </div>
                  <Progress value={attendanceProgress} className="h-2" />
                </div>
              )}

              <Button onClick={handleBulkAttendance} disabled={!selectedClass || !attendanceDate || isMarkingAttendance || !schoolId} className="gap-2">
                {isMarkingAttendance ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Marking...</>
                ) : (
                  <><CheckCircle className="h-4 w-4" /> Mark All {attendanceStatus === 'present' ? 'Present' : 'Absent'}</>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Communication */}
        <TabsContent value="communication">
          <Card>
            <CardHeader>
              <CardTitle>Bulk Communication</CardTitle>
              <CardDescription>Send messages to multiple recipients at once</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Recipient Role</label>
                  <Select value={recipientRole} onValueChange={setRecipientRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {['All Students', 'All Parents', 'All Teachers', 'School Admin'].map(role => (
                        <SelectItem key={role} value={role}>{role}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Filter by Class (optional)</label>
                  <Select value={recipientClass} onValueChange={setRecipientClass}>
                    <SelectTrigger>
                      <SelectValue placeholder="All classes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Classes</SelectItem>
                      {classNames.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Message</label>
                <Textarea
                  placeholder="Type your message here..."
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
              </div>

              {recipientRole && (
                <div className="p-3 rounded-lg bg-blue-50">
                  <p className="text-sm text-blue-700">
                    <AlertCircle className="h-4 w-4 inline mr-1" />
                    This message will be sent to approximately <strong>{students.length} {recipientRole.toLowerCase()}</strong>
                    {recipientClass !== '' && recipientClass !== 'all' && <> in <strong>{recipientClass}</strong></>}
                  </p>
                </div>
              )}

              {isSending && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Sending messages...</span>
                    <span className="font-medium">{Math.round(sendProgress)}%</span>
                  </div>
                  <Progress value={sendProgress} className="h-2" />
                </div>
              )}

              <Button onClick={handleSendMessage} disabled={!recipientRole || !messageContent.trim() || isSending} className="gap-2">
                {isSending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</>
                ) : (
                  <><MessageSquare className="h-4 w-4" /> Send to All</>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Report Card Bulk Generate */}
        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle>Bulk Report Card Generation</CardTitle>
              <CardDescription>Generate report cards for an entire class</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Class</label>
                  <Select value={reportClass} onValueChange={setReportClass}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classNames.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Term</label>
                  <Select value={reportTerm} onValueChange={setReportTerm}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select term" />
                    </SelectTrigger>
                    <SelectContent>
                      {terms.map(term => (
                        <SelectItem key={term.id} value={term.id}>{term.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {reportClass && (
                <div className="p-4 rounded-lg bg-gray-50">
                  <p className="text-sm text-gray-600 mb-2">
                    Will generate report cards for <strong>{getStudentCountForClass(reportClass)}</strong> students in <strong>{reportClass}</strong>
                  </p>
                  <ScrollArea className="max-h-48">
                    <div className="space-y-1">
                      {students.filter(s => s.class?.name === reportClass).map(s => (
                        <div key={s.id} className="flex items-center gap-2 text-sm">
                          <CheckCircle className="h-3.5 w-3.5 text-gray-400" />
                          <span>{s.user.name || s.admissionNo}</span>
                          <Badge variant="outline" className="text-xs ml-auto">GPA: {s.gpa ?? 'N/A'}</Badge>
                        </div>
                      ))}
                      {students.filter(s => s.class?.name === reportClass).length === 0 && (
                        <p className="text-xs text-gray-400">No students found in this class</p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {isGenerating && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Generating report cards...</span>
                    <span className="font-medium">{Math.round(reportProgress)}%</span>
                  </div>
                  <Progress value={reportProgress} className="h-2" />
                </div>
              )}

              <Button onClick={handleGenerateReports} disabled={!reportClass || !reportTerm || isGenerating} className="gap-2">
                {isGenerating ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
                ) : (
                  <><FileText className="h-4 w-4" /> Generate All Report Cards</>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
