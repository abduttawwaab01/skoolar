'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import {
  Sparkles, BarChart3, Calendar, Wallet, Users, MessageSquare,
  Loader2, Lightbulb, TrendingUp, AlertTriangle, CheckCircle2,
} from 'lucide-react';

const commTypes = [
  { value: 'absence', label: 'Absence Notification' },
  { value: 'fee_reminder', label: 'Fee Reminder' },
  { value: 'progress_report', label: 'Progress Report' },
  { value: 'event', label: 'Event Invitation' },
  { value: 'general', label: 'General Communication' },
];

export function AIAdminDashboard() {
  const [activeTab, setActiveTab] = useState('analytics');
  const [analyticsQuery, setAnalyticsQuery] = useState('');
  const [analyticsResult, setAnalyticsResult] = useState<{ insights: Array<Record<string, unknown>>; overallAssessment: string } | null>(null);
  const [optimizeResult, setOptimizeResult] = useState<{ conflictsFound: Array<Record<string, unknown>>; optimizationScore: number; suggestedChanges: Array<Record<string, unknown>>; overallEfficiency: string } | null>(null);
  const [forecastResult, setForecastResult] = useState<{ projectedRevenue: number; projectedExpenses: number; netPosition: number; riskFactors: string[]; recommendations: string[] } | null>(null);
  const [staffResult, setStaffResult] = useState<{ staffInsights: Array<Record<string, unknown>>; departmentTrends: Array<Record<string, unknown>>; overallAssessment: string } | null>(null);
  const [commType, setCommType] = useState('general');
  const [commStudent, setCommStudent] = useState('');
  const [commClass, setCommClass] = useState('');
  const [commDetails, setCommDetails] = useState('');
  const [commResult, setCommResult] = useState<{ subject: string; body: string; tone: string; keyPoints: string[] } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const currentRole = useAppStore(s => s.currentRole);
  const selectedSchoolId = useAppStore(s => s.selectedSchoolId);
  const schoolId = useAppStore(s => s.currentUser.schoolId);
  const effectiveSchoolId = currentRole === 'SUPER_ADMIN' ? selectedSchoolId : schoolId;

  const { data: school } = useQuery({
    queryKey: ['school', effectiveSchoolId],
    queryFn: () => fetch(`/api/schools/${effectiveSchoolId}`).then(r => r.json()),
    enabled: !!effectiveSchoolId,
  });

  const callAI = useCallback(async (endpoint: string, body: Record<string, unknown>) => {
    setIsLoading(true);
    setProgress(10);
    const interval = setInterval(() => setProgress(prev => Math.min(prev + Math.random() * 15, 85)), 500);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId: effectiveSchoolId, ...body }),
      });

      clearInterval(interval);
      setProgress(95);

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Request failed');
      }

      const data = await response.json();
      setProgress(100);
      setTimeout(() => { setIsLoading(false); setProgress(0); }, 300);
      return data;
    } catch (error: unknown) {
      clearInterval(interval);
      setIsLoading(false);
      setProgress(0);
      toast.error(error instanceof Error ? error.message : 'Request failed');
      return null;
    }
  }, [effectiveSchoolId]);

  const handleAnalytics = useCallback(async () => {
    const data = await callAI('/api/ai/admin/analytics', { query: analyticsQuery });
    if (data) setAnalyticsResult(data.data);
  }, [callAI, analyticsQuery]);

  const handleOptimize = useCallback(async () => {
    const data = await callAI('/api/ai/admin/timetable-optimize', {});
    if (data) setOptimizeResult(data.data);
  }, [callAI]);

  const handleForecast = useCallback(async () => {
    const data = await callAI('/api/ai/admin/finance-forecast', {});
    if (data) setForecastResult(data.data);
  }, [callAI]);

  const handleStaffInsights = useCallback(async () => {
    const data = await callAI('/api/ai/admin/staff-insights', {});
    if (data) setStaffResult(data.data);
  }, [callAI]);

  const handleCommunication = useCallback(async () => {
    if (!commStudent.trim()) { toast.error('Student name is required'); return; }
    const data = await callAI('/api/ai/admin/communication', {
      communicationType: commType,
      studentName: commStudent.trim(),
      className: commClass.trim(),
      senderName: school?.name || 'Administrator',
      schoolName: school?.name || 'School',
      details: commDetails ? { message: commDetails } : {},
    });
    if (data) setCommResult(data.data);
  }, [callAI, commType, commStudent, commClass, school, commDetails]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100">
            <Sparkles className="h-6 w-6 text-blue-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">AI Admin Intelligence</h2>
            <p className="text-sm text-gray-500">AI-powered analytics, forecasting, and insights for administrators</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="analytics" className="gap-2"><BarChart3 className="h-4 w-4" /> Analytics</TabsTrigger>
          <TabsTrigger value="timetable" className="gap-2"><Calendar className="h-4 w-4" /> Timetable</TabsTrigger>
          <TabsTrigger value="finance" className="gap-2"><Wallet className="h-4 w-4" /> Finance</TabsTrigger>
          <TabsTrigger value="staff" className="gap-2"><Users className="h-4 w-4" /> Staff</TabsTrigger>
          <TabsTrigger value="communication" className="gap-2"><MessageSquare className="h-4 w-4" /> Comm.</TabsTrigger>
        </TabsList>

        {/* Analytics */}
        <TabsContent value="analytics" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>School Analytics</CardTitle>
              <CardDescription>Ask questions about school performance or generate insights</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="e.g., How are students performing this term? or leave empty for general insights"
                  value={analyticsQuery}
                  onChange={e => setAnalyticsQuery(e.target.value)}
                />
                <Button onClick={handleAnalytics} disabled={isLoading} className="gap-2 shrink-0">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Analyze
                </Button>
              </div>
              {isLoading && activeTab === 'analytics' && <Progress value={progress} className="h-2" />}

              {analyticsResult && (
                <div className="space-y-3 mt-4">
                  {analyticsResult.insights?.map((insight: Record<string, unknown>, i: number) => (
                    <Card key={i} className={`border-l-4 ${insight.priority === 'high' ? 'border-l-red-500' : insight.priority === 'medium' ? 'border-l-amber-500' : 'border-l-blue-500'}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <Lightbulb className={`h-5 w-5 mt-0.5 shrink-0 ${insight.priority === 'high' ? 'text-red-500' : 'text-amber-500'}`} />
                          <div>
                            <p className="font-medium text-sm">{insight.title as string}</p>
                            <p className="text-xs text-gray-600 mt-1">{insight.description as string}</p>
                            {insight.recommendation && (
                              <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-800">
                                <span className="font-medium">Recommendation: </span>{insight.recommendation as string}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {analyticsResult.overallAssessment && (
                    <Card className="bg-gray-50">
                      <CardContent className="p-4">
                        <p className="text-sm text-gray-700"><span className="font-medium">Overall: </span>{analyticsResult.overallAssessment}</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timetable Optimization */}
        <TabsContent value="timetable" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Timetable Conflict Analysis</CardTitle>
              <CardDescription>AI scans all timetables and suggests conflict resolutions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={handleOptimize} disabled={isLoading} className="gap-2">
                {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing...</> : <><Sparkles className="h-4 w-4" /> Scan & Optimize</>}
              </Button>
              {isLoading && activeTab === 'timetable' && <Progress value={progress} className="h-2" />}

              {optimizeResult && (
                <div className="space-y-4 mt-4">
                  <div className="flex gap-4 flex-wrap">
                    <Badge variant="secondary" className="text-sm px-3 py-1">
                      Score: {optimizeResult.optimizationScore}/100
                    </Badge>
                    <Badge variant={optimizeResult.conflictsFound?.length > 0 ? 'destructive' : 'secondary'}>
                      {optimizeResult.conflictsFound?.length || 0} Conflicts Found
                    </Badge>
                  </div>

                  {optimizeResult.conflictsFound?.map((conflict: Record<string, unknown>, i: number) => (
                    <Card key={i} className="border-red-200 bg-red-50">
                      <CardContent className="p-3 flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                        <div className="text-sm">
                          <p className="font-medium text-red-800">{conflict.type as string}: {conflict.description as string}</p>
                          {conflict.suggestedFix && <p className="text-xs text-red-700 mt-1">Fix: {conflict.suggestedFix as string}</p>}
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {optimizeResult.suggestedChanges?.length > 0 && (
                    <Card>
                      <CardHeader><CardTitle className="text-sm">Suggested Changes</CardTitle></CardHeader>
                      <CardContent className="space-y-2">
                        {optimizeResult.suggestedChanges.map((change: Record<string, unknown>, i: number) => (
                          <div key={i} className="p-2 rounded border text-xs">
                            <p><span className="font-medium">From:</span> {change.currentSchedule as string}</p>
                            <p><span className="font-medium">To:</span> {change.suggestedSchedule as string}</p>
                            <p className="text-gray-500">{change.reason as string}</p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {optimizeResult.overallEfficiency && (
                    <p className="text-sm text-gray-600">{optimizeResult.overallEfficiency}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Finance Forecast */}
        <TabsContent value="finance" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Financial Forecasting</CardTitle>
              <CardDescription>AI predicts revenue, expenses, and flags financial risks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={handleForecast} disabled={isLoading} className="gap-2">
                {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Forecasting...</> : <><Sparkles className="h-4 w-4" /> Generate Forecast</>}
              </Button>
              {isLoading && activeTab === 'finance' && <Progress value={progress} className="h-2" />}

              {forecastResult && (
                <div className="space-y-4 mt-4">
                  <div className="grid grid-cols-3 gap-4">
                    <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-green-600">${forecastResult.projectedRevenue?.toLocaleString()}</p><p className="text-xs text-gray-500">Projected Revenue</p></CardContent></Card>
                    <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-red-600">${forecastResult.projectedExpenses?.toLocaleString()}</p><p className="text-xs text-gray-500">Projected Expenses</p></CardContent></Card>
                    <Card><CardContent className="p-4 text-center"><p className={`text-2xl font-bold ${(forecastResult.netPosition || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>${forecastResult.netPosition?.toLocaleString()}</p><p className="text-xs text-gray-500">Net Position</p></CardContent></Card>
                  </div>

                  {forecastResult.riskFactors?.length > 0 && (
                    <Card>
                      <CardHeader><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Risk Factors</CardTitle></CardHeader>
                      <CardContent><ul className="space-y-1">{forecastResult.riskFactors.map((r, i) => <li key={i} className="text-sm flex items-start gap-2"><span className="text-amber-500 mt-0.5">•</span><span>{r}</span></li>)}</ul></CardContent>
                    </Card>
                  )}

                  {forecastResult.recommendations?.length > 0 && (
                    <Card>
                      <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Lightbulb className="h-4 w-4 text-blue-500" /> Recommendations</CardTitle></CardHeader>
                      <CardContent><ul className="space-y-1">{forecastResult.recommendations.map((r, i) => <li key={i} className="text-sm flex items-start gap-2"><span className="text-blue-500 mt-0.5">•</span><span>{r}</span></li>)}</ul></CardContent>
                    </Card>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Staff Insights */}
        <TabsContent value="staff" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Staff Performance Insights</CardTitle>
              <CardDescription>AI analyzes teacher performance data across your school</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={handleStaffInsights} disabled={isLoading} className="gap-2">
                {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing...</> : <><Sparkles className="h-4 w-4" /> Analyze Staff</>}
              </Button>
              {isLoading && activeTab === 'staff' && <Progress value={progress} className="h-2" />}

              {staffResult && (
                <div className="space-y-4 mt-4">
                  {staffResult.staffInsights?.map((teacher: Record<string, unknown>, i: number) => (
                    <Card key={i}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-medium text-sm">{teacher.teacherName as string}</p>
                            <Badge variant={teacher.overallRating === 'Excellent' ? 'default' : teacher.overallRating === 'Good' ? 'secondary' : teacher.overallRating === 'Satisfactory' ? 'outline' : 'destructive'} className="mt-1">
                              {teacher.overallRating as string}
                            </Badge>
                          </div>
                        </div>
                        {(teacher.strengths as string[])?.length > 0 && (
                          <div className="mt-2 text-xs text-green-700"><span className="font-medium">Strengths: </span>{(teacher.strengths as string[]).join(', ')}</div>
                        )}
                        {(teacher.areasForImprovement as string[])?.length > 0 && (
                          <div className="mt-1 text-xs text-amber-700"><span className="font-medium">Improve: </span>{(teacher.areasForImprovement as string[]).join(', ')}</div>
                        )}
                        {teacher.recommendation && <div className="mt-1 text-xs text-blue-700">→ {teacher.recommendation as string}</div>}
                      </CardContent>
                    </Card>
                  ))}

                  {staffResult.overallAssessment && (
                    <Card className="bg-gray-50"><CardContent className="p-4"><p className="text-sm">{staffResult.overallAssessment}</p></CardContent></Card>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Communication */}
        <TabsContent value="communication" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Parent Communication Generator</CardTitle>
              <CardDescription>Draft professional notifications for parents</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Type</Label>
                  <Select value={commType} onValueChange={setCommType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{commTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Student Name *</Label>
                  <Input value={commStudent} onChange={e => setCommStudent(e.target.value)} placeholder="e.g., John Doe" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Class</Label>
                  <Input value={commClass} onChange={e => setCommClass(e.target.value)} placeholder="JSS 2A" />
                </div>
                <div>
                  <Label>Additional Details</Label>
                  <Input value={commDetails} onChange={e => setCommDetails(e.target.value)} placeholder="e.g., Reason for absence" />
                </div>
              </div>

              <Button onClick={handleCommunication} disabled={isLoading || !commStudent.trim()} className="gap-2">
                {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</> : <><Sparkles className="h-4 w-4" /> Draft Message</>}
              </Button>
              {isLoading && activeTab === 'communication' && <Progress value={progress} className="h-2" />}

              {commResult && (
                <Card className="border-blue-200">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{commResult.tone}</Badge>
                      <p className="font-medium text-sm">{commResult.subject}</p>
                    </div>
                    <Separator />
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{commResult.body}</p>
                    {commResult.keyPoints?.length > 0 && (
                      <>
                        <Separator />
                        <ul className="space-y-1">{commResult.keyPoints.map((p, i) => <li key={i} className="text-xs text-gray-600 flex items-start gap-2"><CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />{p}</li>)}</ul>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
