'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ClipboardList, CheckCircle2, Clock, Calendar,
  Trophy, Award, Zap, Loader2, BarChart3,
} from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface TeacherTask {
  id: string;
  title: string;
  description: string | null;
  taskType: string;
  dueDate: string | null;
  priority: string;
  status: string;
  createdAt: string;
  completion: {
    id: string;
    status: string;
    notes: string | null;
    completedAt: string | null;
    feedback: string | null;
  } | null;
}

interface TeacherPerformance {
  id: string;
  teacherId: string;
  teacherName: string;
  taskCompletionScore: number;
  punctualityScore: number;
  classScore: number;
  studentFeedbackScore: number;
  weeklyEvalScore: number;
  totalScore: number;
  rank: number;
}

const taskTypeLabels: Record<string, string> = {
  reading: 'Reading',
  lesson_plan: 'Lesson Plan',
  report: 'Report',
  meeting: 'Meeting',
  class_management: 'Class Mgmt',
  other: 'Other',
};

const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

export function TeacherTasksView() {
  const { currentUser, selectedSchoolId } = useAppStore();
  const schoolId = currentUser.schoolId || selectedSchoolId || '';

  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<TeacherTask[]>([]);
  const [allPerformances, setAllPerformances] = useState<TeacherPerformance[]>([]);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TeacherTask | null>(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    loadData();
  }, [schoolId]);

  async function loadData() {
    setLoading(true);
    try {
      const [tasksRes, perfRes, teacherRes] = await Promise.all([
        fetch(`/api/teacher-tasks?schoolId=${schoolId}`),
        fetch(`/api/teacher-performance?schoolId=${schoolId}`),
        fetch('/api/teachers/stats'),
      ]);

      if (tasksRes.ok) {
        const json = await tasksRes.json();
        setTasks(json.data || json || []);
      }

      if (perfRes.ok) {
        const json = await perfRes.json();
        setAllPerformances(json.data || json || []);
      }

      if (teacherRes.ok) {
        const json = await teacherRes.json();
        setTeacherId(json.teacher?.id || null);
      }
    } catch {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }

  const myPerformance = allPerformances.find(p => p.teacherId === teacherId) || null;

  async function handleStartTask(taskId: string) {
    try {
      const res = await fetch('/api/teacher-tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, status: 'in_progress' }),
      });
      if (res.ok) {
        toast.success('Task started!');
        loadData();
      }
    } catch {
      toast.error('Failed to start task');
    }
  }

  async function handleSubmitCompletion() {
    if (!selectedTask) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/teacher-tasks/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: selectedTask.id, notes: completionNotes }),
      });
      if (res.ok) {
        toast.success('Task submitted for review!');
        setShowCompleteDialog(false);
        setSelectedTask(null);
        setCompletionNotes('');
        loadData();
      } else {
        const json = await res.json();
        toast.error(json.error || 'Failed to submit');
      }
    } catch {
      toast.error('Failed to submit completion');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  const myPendingTasks = tasks.filter(t => t.status === 'pending');
  const myInProgressTasks = tasks.filter(t => t.status === 'in_progress');
  const myCompletedTasks = tasks.filter(t => t.completion?.status === 'approved');

  const rankBadge = myPerformance
    ? myPerformance.rank === 1 ? 'bg-yellow-500'
      : myPerformance.rank === 2 ? 'bg-gray-400'
      : myPerformance.rank === 3 ? 'bg-amber-700'
      : 'bg-emerald-600'
    : 'bg-gray-400';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-emerald-600" />
            My Tasks
          </h2>
          <p className="text-muted-foreground">Complete assigned tasks and track your performance</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{myPendingTasks.length}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{myInProgressTasks.length}</p>
            <p className="text-xs text-muted-foreground">In Progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{myCompletedTasks.length}</p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold" style={{ color: myPerformance?.rank === 1 ? '#EAB308' : myPerformance?.rank === 2 ? '#9CA3AF' : myPerformance?.rank === 3 ? '#B45309' : undefined }}>
              {myPerformance ? `#${myPerformance.rank}` : '-'}
            </p>
            <p className="text-xs text-muted-foreground">My Rank</p>
          </CardContent>
        </Card>
      </div>

      {myPerformance && (
        <Card className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold', rankBadge)}>
                #{myPerformance.rank}
              </div>
              <div>
                <p className="font-semibold">Score: {myPerformance.totalScore} pts</p>
                <div className="flex gap-3 text-xs text-white/80 mt-0.5">
                  <span>Tasks {myPerformance.taskCompletionScore}%</span>
                  <span>Class {myPerformance.classScore}%</span>
                  <span>Eval {myPerformance.weeklyEvalScore}%</span>
                </div>
              </div>
            </div>
            <Trophy className="h-8 w-8 text-yellow-300" />
          </CardContent>
        </Card>
      )}

      {myPendingTasks.length > 0 && (
        <Card className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              <div>
                <p className="font-semibold">{myPendingTasks.length} pending task{myPendingTasks.length !== 1 ? 's' : ''}</p>
                <p className="text-xs text-white/80">Start working on them now</p>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => handleStartTask(myPendingTasks[0].id)}>
              Start First
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending ({myPendingTasks.length})</TabsTrigger>
          <TabsTrigger value="in_progress">In Progress ({myInProgressTasks.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({myCompletedTasks.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-3">
          {myPendingTasks.map(task => (
            <Card key={task.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <Badge className={priorityColors[task.priority]}>{task.priority}</Badge>
                      <Badge variant="outline" className="text-xs">{taskTypeLabels[task.taskType] || task.taskType}</Badge>
                    </div>
                    <h3 className="font-semibold text-sm">{task.title}</h3>
                    {task.description && <p className="text-xs text-muted-foreground mt-1">{task.description}</p>}
                    {task.dueDate && (
                      <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Due {new Date(task.dueDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <Button size="sm" onClick={() => handleStartTask(task.id)}>
                    <Zap className="h-4 w-4 mr-1" /> Start
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {myPendingTasks.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No pending tasks</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="in_progress" className="space-y-3">
          {myInProgressTasks.map(task => (
            <Card key={task.id} className="border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <Badge className="bg-blue-100 text-blue-700">In Progress</Badge>
                      <Badge variant="outline" className="text-xs">{taskTypeLabels[task.taskType] || task.taskType}</Badge>
                    </div>
                    <h3 className="font-semibold text-sm">{task.title}</h3>
                    {task.description && <p className="text-xs text-muted-foreground mt-1">{task.description}</p>}
                    <div className="mt-2 max-w-xs">
                      <Progress value={50} className="h-1.5" />
                    </div>
                  </div>
                  <Button size="sm" onClick={() => { setSelectedTask(task); setShowCompleteDialog(true); }}>
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Submit
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {myInProgressTasks.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No tasks in progress</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-3">
          {myCompletedTasks.map(task => (
            <Card key={task.id} className="border-emerald-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className="bg-emerald-100 text-emerald-700">Completed</Badge>
                      <Badge variant="outline" className="text-xs">{taskTypeLabels[task.taskType] || task.taskType}</Badge>
                    </div>
                    <h3 className="font-semibold text-sm">{task.title}</h3>
                    {task.completion?.feedback && (
                      <p className="text-xs text-muted-foreground mt-1">Feedback: {task.completion.feedback}</p>
                    )}
                  </div>
                  <Award className="h-6 w-6 text-emerald-500" />
                </div>
              </CardContent>
            </Card>
          ))}
          {myCompletedTasks.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Award className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No completed tasks yet</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Task Completion</DialogTitle>
            <DialogDescription>Submit your completed task for admin review</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Task</Label>
              <p className="font-medium text-sm">{selectedTask?.title}</p>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                value={completionNotes}
                onChange={e => setCompletionNotes(e.target.value)}
                placeholder="Describe what you completed..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>Cancel</Button>
            <Button onClick={handleSubmitCompletion} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
