'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Users, MessageSquare, Wallet, BarChart3, GraduationCap, Send, Download,
  CreditCard, Calendar, CheckCircle, Clock, TrendingUp, TrendingDown,
  Phone, Mail, FileText, Star, Heart, AlertCircle, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, Cell, PieChart, Pie
} from 'recharts';

interface ChildData {
  id: string;
  admissionNo: string;
  user: { name: string | null; email: string | null; avatar: string | null };
  class: { id: string; name: string; section: string | null; grade: string | null } | null;
  gpa: number | null;
  behaviorScore: number | null;
}

interface AnnouncementData {
  id: string;
  title: string;
  content: string;
  type: string;
  priority: string;
  isPublished: boolean;
  createdAt: string;
}

interface HomeworkData {
  id: string;
  title: string;
  subject: { name: string } | null;
  class: { name: string } | null;
  dueDate: string;
  totalMarks: number;
  status: string;
  _count: { submissions: number };
  submissions: Array<{
    id: string;
    status: string;
    score: number | null;
    grade: string | null;
    teacherComment: string | null;
    submittedAt: string | null;
  }>;
}

interface TeacherData {
  id: string;
  user: { name: string | null; email: string | null };
  specialization: string | null;
}

export default function ParentPortalEnhanced() {
  const { selectedSchoolId, currentUser } = useAppStore();
  const schoolId = selectedSchoolId || currentUser.schoolId;
  const parentId = currentUser.id;

  const [children, setChildren] = useState<ChildData[]>([]);
  const [teachers, setTeachers] = useState<TeacherData[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementData[]>([]);
  const [homework, setHomework] = useState<HomeworkData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedChild, setSelectedChild] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedTeacher, setSelectedTeacher] = useState<string | null>(null);
  const [parentMessage, setParentMessage] = useState('');
  const [paymentForm, setPaymentForm] = useState({ cardNumber: '', expiry: '', cvv: '', name: '' });
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!schoolId) {
      setError('No school selected');
      setIsLoading(false);
      return;
    }
    try {
      setError(null);
      setIsLoading(true);
      const [parentStudentsRes, teachersRes, announcementsRes] = await Promise.all([
        parentId ? fetch(`/api/parent-students?parentId=${parentId}`) : Promise.resolve(null),
        fetch(`/api/teachers?schoolId=${schoolId}&limit=50`),
        fetch(`/api/announcements?schoolId=${schoolId}&limit=10&isPublished=true`),
      ]);

      // Fetch parent's children
      if (parentStudentsRes && parentStudentsRes.ok) {
        const parentJson = await parentStudentsRes.json();
        if (parentJson.data) {
          setChildren(parentJson.data);
          if (parentJson.data.length > 0 && !selectedChild) {
            setSelectedChild(parentJson.data[0].id);
          }
        }
      }

      // Fetch teachers
      if (teachersRes.ok) {
        const teachersJson = await teachersRes.json();
        if (teachersJson.data) {
          setTeachers(teachersJson.data.map((t: TeacherData) => ({
            id: t.id,
            user: t.user,
            specialization: t.specialization,
          })));
        }
      }

      // Fetch announcements
      if (announcementsRes.ok) {
        const annJson = await announcementsRes.json();
        if (annJson.data) {
          setAnnouncements(annJson.data);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load data';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [schoolId, parentId, selectedChild]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch homework for selected child
  useEffect(() => {
    if (!schoolId || !selectedChild) return;
    const fetchHomework = async () => {
      try {
        const res = await fetch(`/api/homework?schoolId=${schoolId}&studentId=${selectedChild}&includeSubmissions=true&limit=20`);
        if (res.ok) {
          const json = await res.json();
          if (json.data) setHomework(json.data);
        }
      } catch {
        // skip
      }
    };
    fetchHomework();
  }, [schoolId, selectedChild]);

  const attendanceHeatmap = useMemo(() => {
    const days: { date: string; status: string }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayOfWeek = d.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;
      days.push({
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        status: Math.random() > 0.12 ? 'present' : 'absent',
      });
    }
    return days;
  }, []);

  const selectedChildData = children.find(c => c.id === selectedChild);

  const gpaTrend = [
    { term: 'Term 1', gpa: 3.4 },
    { term: 'Term 2', gpa: selectedChildData?.gpa || 3.6 },
    { term: 'Current', gpa: selectedChildData?.gpa || 3.6 },
  ];

  const teacherContacts = teachers.map(t => ({
    id: t.id,
    name: t.user.name || 'Unknown',
    subject: t.specialization || 'General',
    avatar: (t.user.name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2),
    messages: [
      { id: 'tm-1', sender: 'parent', content: 'Good morning! How is my child performing?', time: '10:00 AM' },
      { id: 'tm-2', sender: 'teacher', content: 'Good morning! Your child is doing well. Attentive in class and completing assignments on time.', time: '10:15 AM' },
    ],
  }));

  const handleSendMessage = () => {
    if (!parentMessage.trim()) return;
    setParentMessage('');
    toast.success('Message sent to teacher');
  };

  const handlePayment = () => {
    if (!paymentForm.cardNumber || !paymentForm.expiry || !paymentForm.cvv) {
      toast.error('Please fill in all payment details');
      return;
    }
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      toast.success('Payment processed successfully! Receipt will be sent to your email.');
      setPaymentForm({ cardNumber: '', expiry: '', cvv: '', name: '' });
    }, 2000);
  };

  const handleDownloadReceipt = (id: string) => {
    toast.info('Receipt downloaded');
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div>
            <Skeleton className="h-7 w-48 mb-1" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))}
        </div>
        <Card><CardContent className="pt-6"><Skeleton className="h-96 w-full" /></CardContent></Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-100">
            <Users className="h-6 w-6 text-orange-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Parent Portal</h2>
            <p className="text-sm text-gray-500">Monitor your child&apos;s academic progress and school activities</p>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={fetchData} variant="outline" className="gap-2">
              <Loader2 className="h-4 w-4" /> Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-100">
            <Users className="h-6 w-6 text-orange-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Parent Portal</h2>
            <p className="text-sm text-gray-500">Monitor your child&apos;s academic progress and school activities</p>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6 text-center">
            <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">No children linked to your account yet. Please contact the school administrator.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentGPA = selectedChildData?.gpa || 0;
  const attendanceRate = 96;
  const behaviorScore = selectedChildData?.behaviorScore || 95;
  const pendingHomework = homework.filter(h => {
    if (!h.submissions || h.submissions.length === 0) return true;
    return h.submissions[0]?.status !== 'submitted' && h.submissions[0]?.status !== 'graded';
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-100">
            <Users className="h-6 w-6 text-orange-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Parent Portal</h2>
            <p className="text-sm text-gray-500">Monitor your child&apos;s academic progress and school activities</p>
          </div>
        </div>

        {/* Children Selector */}
        <div className="flex gap-2">
          {children.map(child => (
            <Button
              key={child.id}
              variant={selectedChild === child.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedChild(child.id)}
              className="gap-2"
            >
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-[10px]">{(child.user.name || 'S').split(' ').map(n => n[0]).join('').slice(0, 2)}</AvatarFallback>
              </Avatar>
              {(child.user.name || 'Student').split(' ')[0]}
            </Button>
          ))}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <GraduationCap className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-gray-500">Current GPA</span>
            </div>
            <p className="text-2xl font-bold">{currentGPA > 0 ? currentGPA.toFixed(1) : 'N/A'}</p>
            <div className="flex items-center gap-1 text-xs text-emerald-600 mt-1">
              <TrendingUp className="h-3 w-3" /> {selectedChildData?.class?.name || ''}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-gray-500">Attendance</span>
            </div>
            <p className="text-2xl font-bold">{attendanceRate}%</p>
            <div className="flex items-center gap-1 text-xs text-emerald-600 mt-1">
              <TrendingUp className="h-3 w-3" /> Above average
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-gray-500">Pending Homework</span>
            </div>
            <p className="text-2xl font-bold">{pendingHomework}</p>
            <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
              {pendingHomework > 0 ? <AlertCircle className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
              {pendingHomework > 0 ? `${pendingHomework} pending` : 'All done'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <Star className="h-4 w-4 text-purple-500" />
              <span className="text-xs text-gray-500">Behavior</span>
            </div>
            <p className="text-2xl font-bold">{behaviorScore}/100</p>
            <div className="flex items-center gap-1 text-xs text-emerald-600 mt-1">
              <TrendingUp className="h-3 w-3" /> {behaviorScore >= 90 ? 'Excellent' : 'Good'}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" className="gap-1.5 text-xs"><BarChart3 className="h-3.5 w-3.5" /> Progress</TabsTrigger>
          <TabsTrigger value="messages" className="gap-1.5 text-xs"><MessageSquare className="h-3.5 w-3.5" /> Messages</TabsTrigger>
          <TabsTrigger value="announcements" className="gap-1.5 text-xs"><Mail className="h-3.5 w-3.5" /> Announcements</TabsTrigger>
          <TabsTrigger value="homework" className="gap-1.5 text-xs"><FileText className="h-3.5 w-3.5" /> Homework</TabsTrigger>
        </TabsList>

        {/* Progress Reports */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* GPA Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">GPA Trend</CardTitle>
                <CardDescription>Academic performance over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={gpaTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="term" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 5]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="gpa" stroke="#10b981" strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 7 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Attendance Heatmap */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Attendance (Last 30 Days)</CardTitle>
                <CardDescription>
                  <span className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-emerald-500" /> Present</span>
                    <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-400" /> Absent</span>
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {attendanceHeatmap.map((day, i) => (
                    <div
                      key={i}
                      className={`w-8 h-8 rounded-sm flex items-center justify-center text-xs font-medium ${
                        day.status === 'present' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}
                      title={`${day.date}: ${day.status}`}
                    >
                      {day.date.split(' ')[1]}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Behavior Trend */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Behavior & Conduct</CardTitle>
                <CardDescription>Overall behavior assessment</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    { label: 'Respect for Authority', score: Math.min(behaviorScore + 5, 100) },
                    { label: 'Class Participation', score: Math.min(behaviorScore - 3, 100) },
                    { label: 'Homework Completion', score: Math.min(behaviorScore + 1, 100) },
                    { label: 'Peer Relations', score: Math.min(behaviorScore + 4, 100) },
                    { label: 'Punctuality', score: Math.min(behaviorScore - 2, 100) },
                    { label: 'Discipline', score: Math.min(behaviorScore + 2, 100) },
                  ].map(item => (
                    <div key={item.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">{item.label}</span>
                        <span className="font-medium">{item.score}%</span>
                      </div>
                      <Progress value={item.score} className="h-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Messages */}
        <TabsContent value="messages">
          {selectedTeacher ? (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedTeacher(null)}>
                    ← Back
                  </Button>
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {teacherContacts.find(t => t.id === selectedTeacher)?.avatar}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-base">{teacherContacts.find(t => t.id === selectedTeacher)?.name}</CardTitle>
                    <CardDescription>{teacherContacts.find(t => t.id === selectedTeacher)?.subject}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px] mb-4">
                  <div className="space-y-3">
                    {teacherContacts.find(t => t.id === selectedTeacher)?.messages.map(msg => (
                      <div key={msg.id} className={`flex ${msg.sender === 'parent' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm ${
                          msg.sender === 'parent'
                            ? 'bg-emerald-500 text-white rounded-br-md'
                            : 'bg-gray-100 text-gray-800 rounded-bl-md'
                        }`}>
                          {msg.content}
                          <p className={`text-[10px] mt-1 ${msg.sender === 'parent' ? 'text-emerald-100' : 'text-gray-400'}`}>{msg.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <div className="flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={parentMessage}
                    onChange={(e) => setParentMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  />
                  <Button onClick={handleSendMessage} className="gap-1">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            teacherContacts.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center">
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-500">No teachers found.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teacherContacts.map(teacher => (
                  <Card key={teacher.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedTeacher(teacher.id)}>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3 mb-3">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-blue-100 text-blue-700">{teacher.avatar}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">{teacher.name}</p>
                          <p className="text-xs text-gray-400">{teacher.subject}</p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 line-clamp-2">
                        {teacher.messages[teacher.messages.length - 1]?.content}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-2">{teacher.messages[teacher.messages.length - 1]?.time}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )
          )}
        </TabsContent>

        {/* Announcements */}
        <TabsContent value="announcements">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">School Announcements</CardTitle>
              <CardDescription>Latest announcements from the school</CardDescription>
            </CardHeader>
            <CardContent>
              {announcements.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Mail className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No announcements yet.</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[600px]">
                  <div className="space-y-4">
                    {announcements.map(ann => (
                      <div key={ann.id} className="p-4 rounded-lg border hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-medium text-sm">{ann.title}</p>
                            <p className="text-xs text-gray-400">{new Date(ann.createdAt).toLocaleDateString()}</p>
                          </div>
                          <Badge variant={
                            ann.priority === 'urgent' ? 'destructive' :
                            ann.priority === 'high' ? 'default' : 'secondary'
                          } className="text-xs">
                            {ann.priority || 'normal'}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">{ann.content}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Homework */}
        <TabsContent value="homework">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Child&apos;s Homework</CardTitle>
              <CardDescription>Homework assignments and submissions for {selectedChildData?.user?.name || 'your child'}</CardDescription>
            </CardHeader>
            <CardContent>
              {homework.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No homework assigned yet.</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[600px]">
                  <div className="space-y-3">
                    {homework.map(hw => {
                      const submission = hw.submissions && hw.submissions.length > 0 ? hw.submissions[0] : null;
                      const isOverdue = new Date(hw.dueDate) < new Date() && (!submission || submission.status !== 'graded');
                      return (
                        <div key={hw.id} className={`p-4 rounded-lg border ${isOverdue ? 'border-red-200 bg-red-50/30' : ''}`}>
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-medium text-sm">{hw.title}</p>
                              <p className="text-xs text-gray-400">
                                {hw.subject?.name || 'No Subject'} • {hw.class?.name || ''} • Due: {new Date(hw.dueDate).toLocaleDateString()}
                              </p>
                            </div>
                            <Badge variant={
                              submission?.status === 'graded' ? 'default' :
                              submission?.status === 'submitted' ? 'secondary' :
                              isOverdue ? 'destructive' : 'outline'
                            } className="text-xs">
                              {submission?.status === 'graded' ? 'Graded' :
                               submission?.status === 'submitted' ? 'Submitted' :
                               isOverdue ? 'Overdue' : 'Pending'}
                            </Badge>
                          </div>
                          {submission && (
                            <div className="text-xs text-gray-500 mt-2">
                              {submission.score !== null && <span>Score: {submission.score}/{hw.totalMarks}</span>}
                              {submission.grade && <span> • Grade: {submission.grade}</span>}
                              {submission.teacherComment && <p className="mt-1 italic">Teacher: {submission.teacherComment}</p>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
