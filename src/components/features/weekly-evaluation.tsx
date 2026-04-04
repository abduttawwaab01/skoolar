'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  ClipboardList, Star, User, Calendar, MessageSquare, Target, 
  TrendingUp, Award, Send, Eye, EyeOff, CheckCircle, Loader2 
} from 'lucide-react';
import { toast } from 'sonner';

interface Student {
  id: string;
  name: string;
  admissionNo: string;
  class: string;
}

interface WeeklyEvaluationForm {
  studentId: string;
  weekDate: string; // Monday date of the week
  academicPerformance: number;
  behavior: number;
  attendance: number;
  homework: number;
  effort?: number;
  comments: string;
  goals: string;
  strengths: string;
  areasToImprove: string;
  isShared: boolean;
}

const defaultForm: WeeklyEvaluationForm = {
  studentId: '',
  weekDate: getMonday(new Date()).toISOString().split('T')[0],
  academicPerformance: 3,
  behavior: 3,
  attendance: 3,
  homework: 3,
  effort: 3,
  comments: '',
  goals: '',
  strengths: '',
  areasToImprove: '',
  isShared: true,
};

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}

const RatingScale = [
  { value: 1, label: '1', description: 'Needs Improvement' },
  { value: 2, label: '2', description: 'Developing' },
  { value: 3, label: '3', description: 'Satisfactory' },
  { value: 4, label: '4', description: 'Good' },
  { value: 5, label: '5', description: 'Excellent' },
];

const categories = [
  { key: 'academicPerformance', label: 'Academic Performance', icon: Star, color: 'text-yellow-500' },
  { key: 'behavior', label: 'Behavior', icon: Award, color: 'text-blue-500' },
  { key: 'attendance', label: 'Attendance', icon: TrendingUp, color: 'text-green-500' },
  { key: 'homework', label: 'Homework', icon: ClipboardList, color: 'text-purple-500' },
  { key: 'effort', label: 'Effort', icon: Target, color: 'text-orange-500' },
];

export function WeeklyEvaluation() {
  const [students, setStudents] = useState<Student[]>([]);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [form, setForm] = useState<WeeklyEvaluationForm>(defaultForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [weekFilter, setWeekFilter] = useState(getMonday(new Date()).toISOString().split('T')[0]);
  
  // Fetch teacher's students
  useEffect(() => {
    fetchStudents();
    fetchEvaluations();
  }, []);

  // Fetch evaluations for selected week
  useEffect(() => {
    if (weekFilter) {
      fetchEvaluations(weekFilter);
    }
  }, [weekFilter]);

  async function fetchStudents() {
    try {
      const res = await fetch('/api/students?limit=1000');
      if (res.ok) {
        const json = await res.json();
        const studentList: Student[] = (json.data || []).map((s: any) => ({
          id: s.id,
          name: s.name || s.user?.name || 'Unknown',
          admissionNo: s.admissionNo || 'N/A',
          class: s.class?.name || 'N/A',
        }));
        setStudents(studentList);
      }
    } catch (error) {
      console.error('Failed to fetch students:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchEvaluations(week?: string) {
    try {
      const params = new URLSearchParams();
      if (week) params.set('weekDate', week);
      const res = await fetch(`/api/weekly-evaluations?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setEvaluations(json.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch evaluations:', error);
    }
  }

  function updateForm<K extends keyof WeeklyEvaluationForm>(key: K, value: WeeklyEvaluationForm[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const res = await fetch('/api/weekly-evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      
      const json = await res.json();
      
      if (!res.ok) {
        throw new Error(json.error || 'Failed to submit evaluation');
      }
      
      toast.success('Weekly evaluation submitted successfully!');
      
      // Reset form for next student
      setForm({
        ...defaultForm,
        weekDate: form.weekDate, // Keep same week
      });
      
      // Refresh evaluations list
      fetchEvaluations(form.weekDate);
      
      // Show success action (notify parent if shared)
      if (form.isShared) {
        toast.info('Parent notified of evaluation');
      }
      
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit evaluation');
    } finally {
      setSubmitting(false);
    }
  }

  function getAverageScore(evalData: any): number {
    const scores = [
      evalData.academicPerformance,
      evalData.behavior,
      evalData.attendance,
      evalData.homework,
    ].map(Number);
    if (evalData.effort) scores.push(Number(evalData.effort));
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  function getScoreColor(score: number): string {
    if (score >= 4) return 'text-emerald-600';
    if (score >= 3) return 'text-amber-600';
    return 'text-red-600';
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="size-6 text-emerald-600" />
            Weekly Evaluations
          </h2>
          <p className="text-sm text-gray-500">
            Evaluate student performance weekly. Parents will be notified when shared.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Label htmlFor="weekFilter" className="text-sm">Week of:</Label>
          <Input
            id="weekFilter"
            type="date"
            value={weekFilter}
            onChange={(e) => setWeekFilter(e.target.value)}
            className="w-auto"
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Evaluation Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Submit Evaluation</CardTitle>
            <CardDescription>
              Rate student performance for the week
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Student Selection */}
              <div className="space-y-2">
                <Label htmlFor="student">Student</Label>
                <Select 
                  value={form.studentId} 
                  onValueChange={(value) => updateForm('studentId', value)}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a student" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map(student => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.name} - {student.admissionNo} ({student.class})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Week Date */}
              <div className="space-y-2">
                <Label htmlFor="weekDate">Week Starting</Label>
                <Input
                  id="weekDate"
                  type="date"
                  value={form.weekDate}
                  onChange={(e) => updateForm('weekDate', e.target.value)}
                  required
                />
                <p className="text-xs text-gray-500">
                  Evaluations are for the week beginning Monday
                </p>
              </div>

              <Separator />

              {/* Rating Categories */}
              <div className="space-y-4">
                <Label className="text-sm font-medium">Performance Ratings (1-5)</Label>
                <div className="grid grid-cols-2 gap-3">
                  {categories.map(category => {
                    const Icon = category.icon;
                    return (
                      <div key={category.key} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Icon className={`size-4 ${category.color}`} />
                          <Label className="text-xs">{category.label}</Label>
                        </div>
                        <div className="flex items-center gap-1">
                          {RatingScale.map(rate => (
                            <button
                              key={rate.value}
                              type="button"
                              onClick={() => updateForm(category.key as keyof WeeklyEvaluationForm, rate.value)}
                              className={`
                                flex-1 h-8 rounded text-xs font-medium transition-all
                                ${(form[category.key as keyof WeeklyEvaluationForm] as number) >= rate.value
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}
                              `}
                            >
                              {rate.value}
                            </button>
                          ))}
                        </div>
                        <p className="text-[10px] text-gray-500 h-3">
                          {RatingScale[(form[category.key as keyof WeeklyEvaluationForm] as number) - 1]?.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {/* Comments */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5">
                    <MessageSquare className="size-3" /> Comments
                  </Label>
                  <Textarea
                    value={form.comments}
                    onChange={(e) => updateForm('comments', e.target.value)}
                    placeholder="General comments about the student's week..."
                    rows={2}
                    className="text-sm"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1.5">
                      <Award className="size-3" /> Strengths
                    </Label>
                    <Textarea
                      value={form.strengths}
                      onChange={(e) => updateForm('strengths', e.target.value)}
                      placeholder="What went well..."
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1.5">
                      <Target className="size-3" /> Areas to Improve
                    </Label>
                    <Textarea
                      value={form.areasToImprove}
                      onChange={(e) => updateForm('areasToImprove', e.target.value)}
                      placeholder="Focus areas for next week..."
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5">
                    <TrendingUp className="size-3" /> Goals for Next Week
                  </Label>
                  <Textarea
                    value={form.goals}
                    onChange={(e) => updateForm('goals', e.target.value)}
                    placeholder="Specific goals for improvement..."
                    rows={2}
                    className="text-sm"
                  />
                </div>
              </div>

              <Separator />

              {/* Share with Parents */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 border border-blue-100">
                <div className="flex items-center gap-3">
                  <Send className="size-5 text-blue-600" />
                  <div>
                    <Label htmlFor="isShared" className="text-sm font-medium cursor-pointer">
                      Share with Parents
                    </Label>
                    <p className="text-xs text-gray-600">
                      Parents will receive a notification
                    </p>
                  </div>
                </div>
                <Switch
                  id="isShared"
                  checked={form.isShared}
                  onCheckedChange={(checked) => updateForm('isShared', checked)}
                />
              </div>

              <Button 
                type="submit" 
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                disabled={submitting || !form.studentId}
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="size-4 mr-2" />
                    Submit Evaluation
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Evaluations List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Evaluations This Week</CardTitle>
            <CardDescription>
              {new Date(weekFilter).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })} - {new Date(new Date(weekFilter).getTime() + 6*24*60*60*1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="h-24 rounded-lg bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : evaluations.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <ClipboardList className="size-12 mx-auto mb-2 opacity-50" />
                <p>No evaluations for this week</p>
                <p className="text-xs">Start by submitting your first evaluation</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {evaluations.map((evalData) => (
                  <div key={evalData.id} className="p-4 rounded-lg border bg-white">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-sm">{evalData.studentName}</p>
                        <p className="text-xs text-gray-500">
                          {evalData.studentClass} • {evalData.teacherName}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {evalData.isShared && (
                          <Badge variant="outline" className="text-xs bg-blue-50">
                            <Send className="size-3 mr-1" />
                            Shared
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-xs">
                          {getAverageScore(evalData).toFixed(1)}/5
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-5 gap-2 mb-3">
                      {categories.map(cat => (
                        <div key={cat.key} className="text-center">
                          <div className="text-lg font-bold" style={{
                            color: evalData[cat.key] >= 4 ? '#059669' : evalData[cat.key] >= 3 ? '#d97706' : '#dc2626'
                          }}>
                            {evalData[cat.key]}
                          </div>
                          <div className="text-xs text-gray-500 truncate">{cat.label}</div>
                        </div>
                      ))}
                    </div>
                    
                    {evalData.comments && (
                      <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                        {evalData.comments}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>{new Date(evalData.createdAt).toLocaleDateString()}</span>
                      <span>{evalData.createdAt}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Evaluations Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Evaluations</CardTitle>
          <CardDescription>
            Comprehensive view of weekly evaluations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {evaluations.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              No evaluations found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Student</th>
                    <th className="text-center py-2 px-2">Week</th>
                    <th className="text-center py-2 px-2">Academic</th>
                    <th className="text-center py-2 px-2">Behavior</th>
                    <th className="text-center py-2 px-2">Attendance</th>
                    <th className="text-center py-2 px-2">Homework</th>
                    <th className="text-center py-2 px-2">Avg</th>
                    <th className="text-center py-2 px-2">Shared</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluations.map((evalData) => (
                    <tr key={evalData.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-2">
                        <div>
                          <p className="font-medium">{evalData.studentName}</p>
                          <p className="text-xs text-gray-500">{evalData.studentClass}</p>
                        </div>
                      </td>
                      <td className="text-center py-2 px-2 text-xs">
                        {new Date(evalData.weekDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      <td className="text-center py-2 px-2">
                        <span className={`font-semibold ${getScoreColor(evalData.academicPerformance)}`}>
                          {evalData.academicPerformance}
                        </span>
                      </td>
                      <td className="text-center py-2 px-2">
                        <span className={`font-semibold ${getScoreColor(evalData.behavior)}`}>
                          {evalData.behavior}
                        </span>
                      </td>
                      <td className="text-center py-2 px-2">
                        <span className={`font-semibold ${getScoreColor(evalData.attendance)}`}>
                          {evalData.attendance}
                        </span>
                      </td>
                      <td className="text-center py-2 px-2">
                        <span className={`font-semibold ${getScoreColor(evalData.homework)}`}>
                          {evalData.homework}
                        </span>
                      </td>
                      <td className="text-center py-2 px-2">
                        <span className={`font-bold ${getScoreColor(getAverageScore(evalData))}`}>
                          {getAverageScore(evalData).toFixed(1)}
                        </span>
                      </td>
                      <td className="text-center py-2 px-2">
                        {evalData.isShared ? (
                          <Eye className="size-4 text-blue-600 mx-auto" />
                        ) : (
                          <EyeOff className="size-4 text-gray-300 mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}