'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Brain, TrendingUp, TrendingDown, Target, Award, AlertTriangle, Lightbulb,
  Zap, Users, HelpCircle, BookOpen, Star, ArrowUp, ArrowDown, Minus,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Strength {
  name: string;
  score: number;
  average?: number;
}

interface Weakness {
  name: string;
  score: number;
  average?: number;
}

interface Recommendation {
  type: 'success' | 'warning' | 'danger' | 'info';
  icon?: string;
  title: string;
  description: string;
}

interface TopicBreakdownItem {
  topic: string;
  score: number;
  totalMarks: number;
  correctCount: number;
  totalQuestions: number;
  masteryLevel?: 'mastered' | 'advanced' | 'intermediate' | 'beginner';
}

interface QuestionAnalysisItem {
  questionNumber: number;
  questionText: string;
  type: string;
  marks: number;
  correctRate: number;
  difficulty: string;
  discrimination?: number;
  commonMisconception?: { answer: string; count: number; percentage: number };
}

interface InsightsPanelProps {
  title?: string;
  averageScore?: number;
  passRate?: number;
  totalStudents?: number;
  strengths?: Strength[];
  weaknesses?: Weakness[];
  recommendations?: Recommendation[];
  topicBreakdown?: TopicBreakdownItem[];
  questionAnalysis?: QuestionAnalysisItem[];
  className?: string;
}

const masteryConfig = {
  mastered: { label: 'Mastered', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', barColor: 'bg-emerald-500' },
  advanced: { label: 'Advanced', color: 'bg-blue-100 text-blue-700 border-blue-200', barColor: 'bg-blue-500' },
  intermediate: { label: 'Intermediate', color: 'bg-amber-100 text-amber-700 border-amber-200', barColor: 'bg-amber-500' },
  beginner: { label: 'Beginner', color: 'bg-red-100 text-red-700 border-red-200', barColor: 'bg-red-500' },
};

function getScoreColor(score: number): string {
  if (score >= 70) return 'text-emerald-600';
  if (score >= 50) return 'text-amber-600';
  return 'text-red-600';
}

function getScoreBg(score: number): string {
  if (score >= 70) return 'bg-emerald-50 border-emerald-200';
  if (score >= 50) return 'bg-amber-50 border-amber-200';
  return 'bg-red-50 border-red-200';
}

export function InsightsPanel({
  title = 'Performance Insights',
  averageScore,
  passRate,
  totalStudents,
  strengths,
  weaknesses,
  recommendations,
  topicBreakdown,
  questionAnalysis,
  className,
}: InsightsPanelProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Summary Banner */}
      {(averageScore !== undefined || passRate !== undefined) && (
        <div className={cn('rounded-xl border p-4', getScoreBg(averageScore || 0))}>
          <div className="flex items-center gap-2 mb-3">
            <Brain className={cn('size-5', getScoreColor(averageScore || 0))} />
            <h3 className="font-semibold text-sm">{title}</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            {averageScore !== undefined && (
              <div>
                <p className="text-muted-foreground text-xs">Average Score</p>
                <p className={cn('text-lg font-bold', getScoreColor(averageScore))}>{averageScore.toFixed(1)}%</p>
              </div>
            )}
            {passRate !== undefined && (
              <div>
                <p className="text-muted-foreground text-xs">Pass Rate</p>
                <p className={cn('text-lg font-bold', passRate >= 50 ? 'text-emerald-600' : 'text-red-600')}>{passRate.toFixed(1)}%</p>
              </div>
            )}
            {totalStudents !== undefined && (
              <div>
                <p className="text-muted-foreground text-xs">Total Students</p>
                <p className="text-lg font-bold">{totalStudents}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Strengths & Weaknesses */}
      {((strengths && strengths.length > 0) || (weaknesses && weaknesses.length > 0)) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {strengths && strengths.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Award className="size-4 text-emerald-600" />
                  Strengths
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {strengths.map((s, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{s.name}</span>
                      <div className="flex items-center gap-1.5">
                        <span className={cn('text-sm font-bold', getScoreColor(s.score))}>{s.score}%</span>
                        {s.average !== undefined && (
                          <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-600 border-emerald-200">
                            <ArrowUp className="size-2.5 mr-0.5" />
                            {s.average.toFixed(0)}% avg
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Progress value={s.score} className="h-1.5" indicatorClassName="bg-emerald-500" />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {weaknesses && weaknesses.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="size-4 text-amber-600" />
                  Areas for Improvement
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {weaknesses.map((w, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{w.name}</span>
                      <div className="flex items-center gap-1.5">
                        <span className={cn('text-sm font-bold', getScoreColor(w.score))}>{w.score}%</span>
                        {w.average !== undefined && (
                          <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-600 border-amber-200">
                            <Minus className="size-2.5 mr-0.5" />
                            {w.average.toFixed(0)}% avg
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Progress value={w.score} className="h-1.5" indicatorClassName="bg-amber-500" />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Topic Breakdown */}
      {topicBreakdown && topicBreakdown.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BookOpen className="size-4 text-blue-600" />
              Topic Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topicBreakdown.map((t, i) => {
              const ml = t.masteryLevel ? masteryConfig[t.masteryLevel] : null;
              return (
                <div key={i} className="p-3 rounded-lg border bg-card">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium">{t.topic}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.correctCount}/{t.totalQuestions} correct · {t.totalMarks} marks
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={cn('text-lg font-bold', getScoreColor(t.score))}>{t.score}%</p>
                      {ml && (
                        <Badge className={cn('text-[10px]', ml.color)}>{ml.label}</Badge>
                      )}
                    </div>
                  </div>
                  <Progress value={t.score} className="h-1.5" indicatorClassName={ml?.barColor || 'bg-blue-500'} />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Lightbulb className="size-4 text-amber-600" />
              Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recommendations.map((r, i) => {
              const styles = {
                success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
                warning: 'bg-amber-50 border-amber-200 text-amber-700',
                danger: 'bg-red-50 border-red-200 text-red-700',
                info: 'bg-blue-50 border-blue-200 text-blue-700',
              };
              const icons = {
                success: Award,
                warning: AlertTriangle,
                danger: HelpCircle,
                info: Lightbulb,
              };
              const IconComponent = icons[r.type] || Lightbulb;
              return (
                <div key={i} className={cn('rounded-lg border p-3 flex items-start gap-2.5', styles[r.type])}>
                  <IconComponent className="size-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold">{r.title}</p>
                    <p className="text-xs opacity-80 mt-0.5">{r.description}</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Question Analysis Summary */}
      {questionAnalysis && questionAnalysis.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <HelpCircle className="size-4 text-purple-600" />
              Question Analysis Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-2">#</th>
                    <th className="pb-2 pr-2">Type</th>
                    <th className="pb-2 pr-2">Difficulty</th>
                    <th className="pb-2 pr-2 text-right">Correct %</th>
                    <th className="pb-2 pr-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {questionAnalysis.map((q, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-1.5 pr-2 font-medium">Q{q.questionNumber}</td>
                      <td className="py-1.5 pr-2 text-muted-foreground">{q.type}</td>
                      <td className="py-1.5 pr-2">
                        <Badge variant="outline" className={cn(
                          'text-[10px]',
                          q.correctRate >= 70 ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                          q.correctRate >= 40 ? 'bg-amber-50 text-amber-600 border-amber-200' :
                          'bg-red-50 text-red-600 border-red-200'
                        )}>
                          {q.difficulty}
                        </Badge>
                      </td>
                      <td className="py-1.5 pr-2 text-right font-semibold">{q.correctRate.toFixed(0)}%</td>
                      <td className="py-1.5">
                        <div className="h-1.5 w-16 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              q.correctRate >= 70 ? 'bg-emerald-500' :
                              q.correctRate >= 40 ? 'bg-amber-500' : 'bg-red-500'
                            )}
                            style={{ width: `${q.correctRate}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
